$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
public static class BridgeOutput {
  public static readonly ConcurrentQueue<string> Lines = new ConcurrentQueue<string>();
  public static void Attach(Process process) {
    process.OutputDataReceived += OnData;
    process.ErrorDataReceived += OnData;
    process.BeginOutputReadLine();
    process.BeginErrorReadLine();
  }
  static void OnData(object sender, DataReceivedEventArgs e) {
    if (!string.IsNullOrEmpty(e.Data)) Lines.Enqueue(e.Data);
  }
}
"@

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$form = New-Object System.Windows.Forms.Form
$form.Text = 'اتصال کارتخوان'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(740, 380)
$form.MinimumSize = New-Object System.Drawing.Size(480, 240)
$form.RightToLeft = 'Yes'
$form.RightToLeftLayout = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(16, 20, 28)

$panel = New-Object System.Windows.Forms.Panel
$panel.Dock = 'Fill'
$panel.Padding = New-Object System.Windows.Forms.Padding(18, 14, 18, 14)
$panel.BackColor = $form.BackColor

$box = New-Object System.Windows.Forms.TextBox
$box.Multiline = $true
$box.ReadOnly = $true
$box.ScrollBars = 'Vertical'
$box.Dock = 'Fill'
$box.BorderStyle = 'None'
$box.BackColor = $form.BackColor
$box.ForeColor = [System.Drawing.Color]::FromArgb(236, 242, 247)
$box.Font = New-Object System.Drawing.Font('Tahoma', 15)
$box.RightToLeft = 'Yes'
$panel.Controls.Add($box)
$form.Controls.Add($panel)

$node = $null
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'node'
$psi.Arguments = 'src\main.js'
$psi.WorkingDirectory = $root
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$utf8 = New-Object System.Text.UTF8Encoding $false
$psi.StandardOutputEncoding = $utf8
$psi.StandardErrorEncoding = $utf8

try {
  $node = New-Object System.Diagnostics.Process
  $node.StartInfo = $psi
  [void]$node.Start()
  [BridgeOutput]::Attach($node)
} catch {
  [BridgeOutput]::Lines.Enqueue('برنامه Node.js پیدا نشد. هنگام نصب، افزودن به PATH را انتخاب کنید.')
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 150
$timer.Add_Tick({
  $line = $null
  while ([BridgeOutput]::Lines.TryDequeue([ref]$line)) {
    $box.AppendText($line + [Environment]::NewLine)
  }
  if ($box.Lines.Count -gt 220) {
    $box.Lines = @($box.Lines | Select-Object -Last 160)
    $box.SelectionStart = $box.TextLength
    $box.ScrollToCaret()
  }
})
$timer.Start()

$form.Add_FormClosing({
  $timer.Stop()
  try { if ($node) { $node.Kill() } } catch {}
})

[void]$form.ShowDialog()
$timer.Dispose()
try { if ($node) { $node.Kill() } } catch {}
