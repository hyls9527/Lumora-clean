//! Timeout-bounded sidecar execution.
//!
//! Every Python sidecar (CLIP, aesthetic scoring) used to be launched with
//! `Command::output()`, which waits forever. A sidecar that hangs — a model
//! download stalling, a CUDA driver wedging, a malformed image sending the
//! decoder into a loop — therefore pinned a Tauri worker thread *and* left a
//! live child process behind, with no way for the user to cancel. That is a
//! direct availability and crash-rate risk.
//!
//! `run_with_timeout` keeps the same "capture stdout/stderr" contract but
//! bounds the wait: on timeout the child is killed (Windows: the whole
//! process tree, since the sidecar may have spawned workers) and a visible
//! error is returned instead of hanging.

use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::error::{AppError, AppResult};

/// Default budget for one sidecar invocation. Loading a CLIP/ViT model on CPU
/// takes tens of seconds; anything past this is a hang, not slow progress.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(600);

/// Captured result of a finished sidecar process.
#[derive(Debug)]
pub struct SidecarOutput {
    pub status: std::process::ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

/// Run `cmd` to completion, killing it after `timeout`.
///
/// stdout/stderr are drained on separate threads so a chatty sidecar cannot
/// deadlock against a full pipe buffer.
pub fn run_with_timeout(mut cmd: Command, timeout: Duration) -> AppResult<SidecarOutput> {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::External(format!("Failed to run sidecar: {e}")))?;

    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();
    let out_handle = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(pipe) = stdout_pipe.as_mut() {
            let _ = pipe.read_to_end(&mut buf);
        }
        buf
    });
    let err_handle = std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(pipe) = stderr_pipe.as_mut() {
            let _ = pipe.read_to_end(&mut buf);
        }
        buf
    });

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if started.elapsed() > timeout {
                    // Kill before waiting again: the process may already have
                    // spawned workers that would keep the pipes open.
                    kill_tree(&mut child);
                    let _ = child.wait();
                    let _ = out_handle.join();
                    let _ = err_handle.join();
                    return Err(AppError::External(format!(
                        "Sidecar timed out after {}s and was terminated",
                        timeout.as_secs()
                    )));
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => {
                kill_tree(&mut child);
                return Err(AppError::External(format!(
                    "Failed to wait for sidecar: {e}"
                )));
            }
        }
    };

    let stdout = out_handle.join().unwrap_or_default();
    let stderr = err_handle.join().unwrap_or_default();
    Ok(SidecarOutput {
        status,
        stdout,
        stderr,
    })
}

/// Terminate a child and everything it spawned.
///
/// The sidecar is a Python process that may fork worker processes (torch data
/// loaders, ffmpeg); killing only the direct child would leave them holding
/// the machine's CPU.
pub fn kill_tree(child: &mut std::process::Child) {
    #[cfg(windows)]
    {
        // taskkill /T kills the tree; /F forces it. Best effort: if the tool
        // is missing we still kill the direct child below.
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fast command returns its real output and exit status.
    #[cfg(windows)]
    fn echo_cmd(text: &str) -> Command {
        let mut c = Command::new("cmd");
        c.args(["/C", "echo", text]);
        c
    }

    #[cfg(not(windows))]
    fn echo_cmd(text: &str) -> Command {
        let mut c = Command::new("sh");
        c.args(["-c", &format!("echo {text}")]);
        c
    }

    /// A command that sleeps far longer than the timeout.
    ///
    /// `timeout /T` is not usable here: it needs an interactive console and
    /// exits immediately with "Input redirection is not supported" under a
    /// test harness, which made the timeout test pass for the wrong reason.
    #[cfg(windows)]
    fn sleep_cmd(seconds: u32) -> Command {
        let mut c = Command::new("powershell");
        c.args([
            "-NoProfile",
            "-Command",
            &format!("Start-Sleep -Seconds {seconds}"),
        ]);
        c
    }

    #[cfg(not(windows))]
    fn sleep_cmd(seconds: u32) -> Command {
        let mut c = Command::new("sh");
        c.args(["-c", &format!("sleep {seconds}")]);
        c
    }

    #[test]
    fn captures_stdout_and_status() {
        let out = run_with_timeout(echo_cmd("hello-sidecar"), Duration::from_secs(30)).unwrap();
        assert!(out.status.success());
        assert!(String::from_utf8_lossy(&out.stdout).contains("hello-sidecar"));
    }

    /// The whole point: a hung sidecar must not hang the caller.
    #[test]
    fn hanging_sidecar_is_killed_and_reported() {
        let started = Instant::now();
        let err = run_with_timeout(sleep_cmd(30), Duration::from_millis(400)).unwrap_err();
        let elapsed = started.elapsed();

        assert!(
            err.to_string().contains("timed out"),
            "unexpected error: {err}"
        );
        // Must return promptly after the deadline, not when the child would
        // have finished on its own.
        assert!(
            elapsed < Duration::from_secs(10),
            "timed-out sidecar returned after {elapsed:?}"
        );
    }

    /// Failure exit codes are surfaced to the caller, not swallowed.
    #[cfg(windows)]
    #[test]
    fn nonzero_exit_status_is_returned() {
        let mut c = Command::new("cmd");
        c.args(["/C", "exit", "3"]);
        let out = run_with_timeout(c, Duration::from_secs(30)).unwrap();
        assert!(!out.status.success());
    }
}
