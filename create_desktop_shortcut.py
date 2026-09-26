import os
import sys
import winreg
import subprocess

def get_desktop_paths():
    paths = []
    # 1. From Registry
    try:
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"
        )
        desktop_val, _ = winreg.QueryValueEx(key, "Desktop")
        expanded = os.path.expandvars(desktop_val)
        if os.path.exists(expanded):
            paths.append(expanded)
    except Exception as e:
        print("Registry lookup error:", e)

    # 2. Standard USERPROFILE Desktop
    userprofile = os.environ.get("USERPROFILE", "")
    if userprofile:
        d1 = os.path.join(userprofile, "Desktop")
        if os.path.exists(d1) and d1 not in paths:
            paths.append(d1)
        d2 = os.path.join(userprofile, "OneDrive", "Desktop")
        if os.path.exists(d2) and d2 not in paths:
            paths.append(d2)
            
    return paths

def create_windows_shortcut(desktop_dir, target_path, arguments, work_dir, icon_path, description, name="Datanova AI.lnk"):
    shortcut_path = os.path.join(desktop_dir, name)
    ps_script = f"""
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("{shortcut_path.replace('"', '`"')}")
$Shortcut.TargetPath = "{target_path.replace('"', '`"')}"
$Shortcut.Arguments = '{arguments.replace("'", "''")}'
$Shortcut.WorkingDirectory = "{work_dir.replace('"', '`"')}"
$Shortcut.IconLocation = "{icon_path.replace('"', '`"')}"
$Shortcut.Description = "{description.replace('"', '`"')}"
$Shortcut.WindowStyle = 1
$Shortcut.Save()
"""
    cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"Successfully created shortcut at: {shortcut_path}")
        return True
    else:
        print(f"Failed to create shortcut at {shortcut_path}: {res.stderr}")
        return False

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    ico_path = os.path.join(root_dir, "datanova.ico")
    pyw_script = os.path.join(root_dir, "launch_datanova.pyw")
    
    # Find pythonw.exe
    python_exe = sys.executable
    pythonw_exe = python_exe.lower().replace("python.exe", "pythonw.exe")
    if not os.path.exists(pythonw_exe):
        pythonw_exe = python_exe

    desktops = get_desktop_paths()
    print("Found Desktop locations:", desktops)

    for d in desktops:
        create_windows_shortcut(
            desktop_dir=d,
            target_path=pythonw_exe,
            arguments=f'"{pyw_script}"',
            work_dir=root_dir,
            icon_path=ico_path,
            description="Datanova AI — Autonomous Data Intelligence Platform",
            name="Datanova AI.lnk"
        )
        
    # Also create a shortcut in the project root directory
    create_windows_shortcut(
        desktop_dir=root_dir,
        target_path=pythonw_exe,
        arguments=f'"{pyw_script}"',
        work_dir=root_dir,
        icon_path=ico_path,
        description="Datanova AI — Autonomous Data Intelligence Platform",
        name="Datanova AI.lnk"
    )

if __name__ == "__main__":
    main()
