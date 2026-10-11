Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\12121212"
WshShell.Run """C:\Program Files\nodejs\node.exe"" ""C:\12121212\runner.js""", 0, False
