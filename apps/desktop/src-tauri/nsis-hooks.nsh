; Custom NSIS installer hooks for StorageOS.
;
; The agent (storageos-agent.exe) runs as a detached background process, so the
; installer can't overwrite it on upgrade — that produced "Error opening file
; for writing ... storageos-agent.exe". Kill the agent (and the app, in case
; it's still up) before copying files.

!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec 'taskkill /F /IM "storageos-agent.exe" /T'
  nsExec::Exec 'taskkill /F /IM "storageos-desktop.exe" /T'
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec 'taskkill /F /IM "storageos-agent.exe" /T'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend
