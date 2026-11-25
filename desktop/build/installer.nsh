; Extra install step (Plan 21): the database (mongod.exe) needs the Microsoft
; Visual C++ runtime (MSVCP140.dll, VCRUNTIME140.dll, VCRUNTIME140_1.dll).
; A fresh Windows may not have it. The Microsoft installer does nothing if a
; same or newer version is already there.
!macro customInstall
  DetailPrint "Installing the Microsoft Visual C++ runtime..."
  File /oname=$PLUGINSDIR\vc_redist.x64.exe "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
  ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /install /quiet /norestart' $0
  DetailPrint "Visual C++ runtime: done (code $0)"
!macroend
