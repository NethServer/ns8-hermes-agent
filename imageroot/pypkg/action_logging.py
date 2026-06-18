import json
import shlex
import subprocess
import sys


def _format_command(command):
    if isinstance(command, (list, tuple)):
        return shlex.join(str(part) for part in command)
    return str(command)


def _print_stream(label, value):
    if value is None:
        return

    text = value.strip() if isinstance(value, str) else str(value).strip()
    if text:
        print(f"{label}: {text}", file=sys.stderr)


def describe_task_failure(operation, response):
    message = f"{operation} failed with exit code {response.get('exit_code')}"
    details = []

    for field in ("error", "output"):
        value = response.get(field)
        if value not in (None, "", [], {}):
            details.append(f"{field}={json.dumps(value, default=str)}")

    if details:
        message += f" ({', '.join(details)})"

    return message


def log_action_failure(action_name, error):
    if isinstance(error, subprocess.CalledProcessError):
        print(
            f"{action_name} failed while running {_format_command(error.cmd)} "
            f"(exit code {error.returncode})",
            file=sys.stderr,
        )
        _print_stream(f"{action_name} stdout", getattr(error, "stdout", None))
        _print_stream(f"{action_name} stderr", getattr(error, "stderr", None))
        return

    message = str(error).strip() or error.__class__.__name__
    print(f"{action_name} failed: {message}", file=sys.stderr)