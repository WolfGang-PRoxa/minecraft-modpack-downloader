!include "WordFunc.nsh"

; Le raccourci du bureau est créé par l'application (au premier lancement ou dans ses paramètres),
; pas par l'installeur : on le retire à la désinstallation, mais pas lors d'une mise à jour.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  ${endIf}
!macroend

; Au lancement de l'installeur, on vérifie si l'application est déjà installée (et intacte) :
;  - même version        : on propose de l'ouvrir plutôt que de tout réinstaller ;
;  - version plus récente : on prévient avant un retour en arrière ;
;  - version plus ancienne : mise à jour, sans question.
; Aucune question en mode silencieux (/S) ni lors d'une mise à jour lancée par l'application (--updated).
!macro customInit
  ${IfNot} ${Silent}
  ${AndIfNot} ${isUpdated}
    ReadRegStr $R0 SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ${If} $R0 != ""
    ${AndIf} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
      ; $R1 : 0 = même version, 1 = celle installée est plus récente, 2 = cet installeur est plus récent
      ${VersionCompare} "$R0" "${VERSION}" $R1
      ${If} $R1 == 0
        MessageBox MB_YESNOCANCEL|MB_ICONINFORMATION|MB_SETFOREGROUND \
          "${PRODUCT_NAME} ${VERSION} est déjà installé sur ce PC.$\r$\n$\r$\nVeux-tu l’ouvrir ?$\r$\n$\r$\n• Oui : ouvrir l’application$\r$\n• Non : la réinstaller$\r$\n• Annuler : ne rien faire" \
          /SD IDNO IDYES mpdOpenInstalled IDNO mpdInstall
        Quit
      ${ElseIf} $R1 == 1
        MessageBox MB_YESNOCANCEL|MB_ICONEXCLAMATION|MB_SETFOREGROUND \
          "Une version plus récente de ${PRODUCT_NAME} est déjà installée sur ce PC : la $R0 (cet installeur contient la ${VERSION}).$\r$\n$\r$\nVeux-tu ouvrir la version installée ?$\r$\n$\r$\n• Oui : ouvrir l’application$\r$\n• Non : revenir à la version ${VERSION}$\r$\n• Annuler : ne rien faire" \
          /SD IDNO IDYES mpdOpenInstalled IDNO mpdInstall
        Quit
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Goto mpdInstall

  mpdOpenInstalled:
    ; Si l'application tourne déjà, son verrou d'instance ramène simplement sa fenêtre au premier plan.
    ${StdUtils.ExecShellAsUser} $R2 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "open" ""
    !insertmacro quitSuccess

  mpdInstall:
!macroend
