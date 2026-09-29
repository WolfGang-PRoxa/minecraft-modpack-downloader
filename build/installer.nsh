; Le raccourci du bureau est créé par l'application (au premier lancement ou dans ses paramètres),
; pas par l'installeur : on le retire à la désinstallation, mais pas lors d'une mise à jour.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    Delete "$DESKTOP\Modpack Downloader.lnk"
  ${endIf}
!macroend
