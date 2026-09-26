import os
import sys
import time
import urllib.request
import urllib.error
import subprocess
import webbrowser

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
NODE_PATH = r"C:\Users\Mohamed Fazil J\AppData\Local\OpenAI\Codex\runtimes\cua_node\23828fd353da361d\bin"

BACKEND_URL = "http://127.0.0.1:8000/docs"
FRONTEND_URL = "http://localhost:5173"

CREATE_NO_WINDOW = 0x08000000

def is_service_alive(url, timeout=1.0):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Datanova-Launcher"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status in (200, 301, 302, 304)
    except Exception:
        return False

def start_backend():
    if is_service_alive(BACKEND_URL):
        return None
    py_dir = os.path.dirname(sys.executable)
    py_exe = os.path.join(py_dir, "python.exe")
    if not os.path.exists(py_exe):
        py_exe = sys.executable
    cmd = [py_exe, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"]
    log_file = open(os.path.join(BACKEND_DIR, "backend_service.log"), "a", encoding="utf-8")
    return subprocess.Popen(
        cmd,
        cwd=BACKEND_DIR,
        stdout=log_file,
        stderr=log_file,
        creationflags=CREATE_NO_WINDOW
    )


def get_node_path():
    candidates = [
        NODE_PATH,
        r"C:\Program Files\nodejs",
        r"C:\Program Files (x86)\nodejs",
        os.path.expandvars(r"%LocalAppData%\Programs\node"),
    ]
    for p in candidates:
        if p and os.path.exists(os.path.join(p, "node.exe")):
            return p
    return None

def start_frontend():
    if is_service_alive(FRONTEND_URL):
        return None
    env = os.environ.copy()
    node_dir = get_node_path()
    if node_dir:
        env["PATH"] = node_dir + ";" + env.get("PATH", "")
    
    cmd = ["cmd.exe", "/c", "npm.cmd run dev"]
    log_file = open(os.path.join(FRONTEND_DIR, "frontend_service.log"), "a", encoding="utf-8")
    return subprocess.Popen(
        cmd,
        cwd=FRONTEND_DIR,
        env=env,
        stdout=log_file,
        stderr=log_file,
        creationflags=CREATE_NO_WINDOW
    )

def wait_for_services(max_seconds=12):
    start_time = time.time()
    while time.time() - start_time < max_seconds:
        b_alive = is_service_alive(BACKEND_URL, 0.4)
        f_alive = is_service_alive(FRONTEND_URL, 0.4)
        if b_alive and f_alive:
            return True
        time.sleep(0.3)
    return False

def find_browser_for_app_mode():
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None

def launch_app_window():
    browser = find_browser_for_app_mode()
    if browser:
        args = [
            browser,
            f"--app={FRONTEND_URL}",
            "--window-size=1440,900",
            "--start-maximized",
            "--app-id=datanova_ai_app"
        ]
        subprocess.Popen(args, creationflags=CREATE_NO_WINDOW)
    else:
        webbrowser.open(FRONTEND_URL)

def main():
    # 1. Start backend & frontend if not running
    start_backend()
    start_frontend()

    # 2. Wait until both respond
    wait_for_services(max_seconds=15)

    # 3. Open directly as standalone desktop App window
    launch_app_window()

if __name__ == "__main__":
    main()
