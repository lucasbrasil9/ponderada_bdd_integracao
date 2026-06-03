#!/usr/bin/env python3
"""Coleta métricas de todas as runs de um workflow no GitHub Actions.

Saída: analytics/metrics.csv com colunas:
  run_id, commit_sha, commit_message, status, conclusion,
  workflow_duration, job_name, job_duration, step_name, step_duration,
  test_count, test_failures, avg_test_time_ms, timestamp,
  commit_short, branch, run_number, run_attempt

Uso:
  export GITHUB_TOKEN=ghp_xxx
  export REPO=lucasbrasil9/ponderada_bdd_integracao
  python3 collect_metrics.py --workflow ci.yml --out metrics.csv
"""

import argparse
import csv
import io
import json
import os
import sys
import time
import zipfile
from datetime import datetime

import requests

API = "https://api.github.com"


def auth_headers():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("ERRO: defina GITHUB_TOKEN no ambiente (PAT com escopo 'repo' e 'actions:read').")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def parse_iso(s):
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def sec_between(start_iso, end_iso):
    s = parse_iso(start_iso)
    e = parse_iso(end_iso)
    if not s or not e:
        return None
    return round((e - s).total_seconds(), 3)


def get_workflow_id(repo, workflow_file, session):
    """Resolve o workflow file (ex: ci.yml) para o ID numérico."""
    url = f"{API}/repos/{repo}/actions/workflows/{workflow_file}"
    r = session.get(url)
    r.raise_for_status()
    return r.json()["id"]


def list_all_runs(repo, workflow_id, session, per_page=100):
    runs = []
    page = 1
    while True:
        url = f"{API}/repos/{repo}/actions/workflows/{workflow_id}/runs"
        r = session.get(url, params={"per_page": per_page, "page": page})
        r.raise_for_status()
        data = r.json()
        runs.extend(data["workflow_runs"])
        if len(data["workflow_runs"]) < per_page:
            break
        page += 1
        time.sleep(0.2)
    return runs


def get_commit_message(repo, sha, session):
    url = f"{API}/repos/{repo}/commits/{sha}"
    r = session.get(url)
    if r.status_code != 200:
        return ""
    return (r.json().get("commit", {}).get("message") or "").split("\n")[0]


def get_jobs(repo, run_id, session):
    jobs = []
    page = 1
    while True:
        url = f"{API}/repos/{repo}/actions/runs/{run_id}/jobs"
        r = session.get(url, params={"per_page": 100, "page": page})
        r.raise_for_status()
        jobs.extend(r.json()["jobs"])
        if len(r.json()["jobs"]) < 100:
            break
        page += 1
        time.sleep(0.2)
    return jobs


def download_test_metrics_artifact(repo, run_id, session):
    """Baixa artefato 'test-results' e retorna dict com test_count/failures/avg."""
    url = f"{API}/repos/{repo}/actions/runs/{run_id}/artifacts"
    r = session.get(url)
    if r.status_code != 200:
        return None
    arts = r.json().get("artifacts", [])
    target = next((a for a in arts if a["name"] == "test-results"), None)
    if not target:
        return None
    download_url = target["archive_download_url"]
    r2 = session.get(download_url, allow_redirects=True)
    if r2.status_code != 200:
        return None
    try:
        z = zipfile.ZipFile(io.BytesIO(r2.content))
        for name in z.namelist():
            if name.endswith("test-metrics.json"):
                return json.loads(z.read(name).decode("utf-8"))
        return None
    except Exception:
        return None


def collect(repo, workflow_file, output_csv):
    with requests.Session() as session:
        session.headers.update(auth_headers())
        print(f"[i] Resolvendo workflow '{workflow_file}' em {repo}...")
        workflow_id = get_workflow_id(repo, workflow_file, session)
        print(f"[i] workflow_id = {workflow_id}")

        print("[i] Listando runs...")
        runs = list_all_runs(repo, workflow_id, session)
        print(f"[i] {len(runs)} runs encontradas.")

        rows = []
        for idx, run in enumerate(runs, 1):
            run_id = run["id"]
            sha = run["head_sha"]
            branch = run["head_branch"]
            status = run["status"]
            conclusion = run["conclusion"] or "in_progress"
            created = run["created_at"]
            updated = run["updated_at"]
            wf_dur = sec_between(created, updated)

            print(f"[{idx}/{len(runs)}] run_id={run_id} sha={sha[:7]} {conclusion} ({wf_dur}s)")

            commit_msg = get_commit_message(repo, sha, session)
            test_metrics = download_test_metrics_artifact(repo, run_id, session) or {}
            jobs = get_jobs(repo, run_id, session)

            if not jobs:
                rows.append({
                    "run_id": run_id, "commit_sha": sha, "commit_message": commit_msg,
                    "status": status, "conclusion": conclusion,
                    "workflow_duration": wf_dur, "job_name": "", "job_duration": "",
                    "step_name": "", "step_duration": "",
                    "test_count": test_metrics.get("test_count", ""),
                    "test_failures": test_metrics.get("test_failures", ""),
                    "avg_test_time_ms": test_metrics.get("avg_test_time_ms", ""),
                    "timestamp": created, "commit_short": sha[:7],
                    "branch": branch, "run_number": run["run_number"],
                    "run_attempt": run["run_attempt"],
                })
                continue

            for job in jobs:
                job_dur = sec_between(job["started_at"], job["completed_at"])
                steps = job.get("steps") or []
                if not steps:
                    rows.append({
                        "run_id": run_id, "commit_sha": sha, "commit_message": commit_msg,
                        "status": status, "conclusion": conclusion,
                        "workflow_duration": wf_dur,
                        "job_name": job["name"], "job_duration": job_dur,
                        "step_name": "", "step_duration": "",
                        "test_count": test_metrics.get("test_count", ""),
                        "test_failures": test_metrics.get("test_failures", ""),
                        "avg_test_time_ms": test_metrics.get("avg_test_time_ms", ""),
                        "timestamp": created, "commit_short": sha[:7],
                        "branch": branch, "run_number": run["run_number"],
                        "run_attempt": run["run_attempt"],
                    })
                else:
                    for step in steps:
                        step_dur = sec_between(step["started_at"], step["completed_at"])
                        rows.append({
                            "run_id": run_id, "commit_sha": sha, "commit_message": commit_msg,
                            "status": status, "conclusion": conclusion,
                            "workflow_duration": wf_dur,
                            "job_name": job["name"], "job_duration": job_dur,
                            "step_name": step["name"], "step_duration": step_dur,
                            "test_count": test_metrics.get("test_count", ""),
                            "test_failures": test_metrics.get("test_failures", ""),
                            "avg_test_time_ms": test_metrics.get("avg_test_time_ms", ""),
                            "timestamp": created, "commit_short": sha[:7],
                            "branch": branch, "run_number": run["run_number"],
                            "run_attempt": run["run_attempt"],
                        })
            time.sleep(0.3)

        if not rows:
            print("[!] Nenhuma run processada.")
            return
        cols = list(rows[0].keys())
        with open(output_csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(rows)
        print(f"[OK] {len(rows)} linhas gravadas em {output_csv}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", default=os.environ.get("REPO"),
                   help="owner/repo (ex: lucasbrasil9/ponderada_bdd_integracao)")
    p.add_argument("--workflow", default=os.environ.get("WORKFLOW_FILE", "ci.yml"))
    p.add_argument("--out", default="metrics.csv")
    args = p.parse_args()
    if not args.repo:
        sys.exit("ERRO: --repo ou env REPO obrigatório.")
    collect(args.repo, args.workflow, args.out)


if __name__ == "__main__":
    main()
