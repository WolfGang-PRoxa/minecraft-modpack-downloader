# CLAUDE.md

Application Windows (Electron) qui affiche les modpacks Minecraft publiés en releases sur
`WolfGang-PRoxa/minecraft-modpack-downloader` et les installe directement comme profils CurseForge.
Deux fenêtres dans la même application : l'app des joueurs, et le **Modpack Studio** (`--studio`) où l'auteur
range ses zips et publie les releases. Interface et messages en français.

## Règles git — impératif

- **Ne jamais mentionner Claude** dans les commits, PR, tags ou fichiers : pas de ligne
  `Co-Authored-By`, pas de « Generated with Claude Code », pas de Claude parmi les contributeurs.
  L'auteur des commits est celui de la config git locale.
- Messages de commit en français, au format conventionnel (`feat: …`, `fix: …`, `docs: …`).
- Ne pas créer de release ni pousser de tag sans demande explicite (un tag `app-v*` déclenche la CI).

## Commandes

```bash
npm run dev              # app en développement (HMR)
npm run typecheck        # tsc sur main/preload/scripts puis sur le renderer
npm run build            # typecheck + build electron-vite dans out/
npm run build:win        # installeur NSIS dans dist/
npm run studio           # Modpack Studio (electron-vite dev -- --studio)
npm run modpacks:ranger  # numérote les zips déposés (--dir, --yes)
npm run modpacks:publier # met les releases en accord avec le dossier (--dir, --yes, --dry-run)
npx tsx scripts/generate-icon.ts   # régénère build/icon.png depuis src/shared/logo.ts
```

## Architecture

- `src/main/` — processus principal
  - `github.ts` : lecture des releases (cache ETag sur disque, mode hors ligne), `modpack.json` via l'URL publique
    (hors quota API), détection de mise à jour de l'app (tags `app-v*`).
  - `installer.ts` : téléchargement → vérif SHA-256 → extraction dans un dossier de travail sur le même disque
    que `Instances` → basculement par renommage. Mise à jour sur place en conservant les données du joueur
    (`PLAYER_DATA`) et ses champs de `minecraftinstance.json` (`PRESERVED_INSTANCE_FIELDS`).
  - `curseforge.ts` : détection (protocole `curseforge://` dans `HKCR`, puis chemins connus Overwolf/autonome),
    lancement, dossier `Instances` (réglage > logs CurseForge > défaut), détection de Minecraft lancé.
  - `zip.ts` (yauzl, protection zip-slip, accepte un zip avec dossier racine), `download.ts`, `ipc.ts`, `appUpdate.ts`.
  - `shortcut.ts` : raccourci `.lnk` (bureau ou emplacement choisi) pour l'app joueur et le studio (`--studio`).
    Non packagée : cible `electron.exe "<projet>"` et icône `.ico` générée depuis `build/icon.png`.
  - `index.ts` : `--studio` règle nom, `userData` (`%APPDATA%\Modpack Studio`), verrou et protocole `studio-media:`
    avant `ready`, puis charge `studio/app.ts` en import dynamique (l'app joueur ne le charge jamais).
- `src/main/studio/` — le studio. Tout est Node pur (réutilisé par `scripts/modpacks.ts`) sauf `app.ts` (Electron :
  fenêtre, IPC `studio:*`, surveillance du dossier, jeton chiffré par `safeStorage`, images via `studio-media://cover/`).
  - `workspace.ts` : lecture du dossier (un sous-dossier par modpack, `pack.json`, `cover.*`), rangement (`planRanger`/`applyRanger`).
  - `analyze.ts` : validation d'un zip (instance CurseForge, refus des exports `manifest.json`), SHA-256, cache `.studio-cache.json`.
  - `sync.ts` : `computePlan` (dossier ↔ releases `pack-*` : create / update / delete) et `applyPlan`.
  - `githubApi.ts` : client d'écriture (jeton : `GITHUB_TOKEN` > studio > `.env` > `gh auth token`), envois en streaming.
  - `archive.ts` : zip d'une instance (`DEFAULT_EXCLUDES`), `service.ts` : orchestration + verrou d'exclusivité.
- `src/preload/` — `index.ts` expose `window.api` (`RendererApi`), `studio.ts` expose `window.studio` (`StudioApi`,
  `src/shared/studio.ts`). Aucun module partagé entre les deux : un preload sandboxé ne peut pas charger de chunk.
- `src/renderer/` — React 19 + Tailwind v4 + zustand. `index.html` + `src/` pour les joueurs, `studio.html` +
  `src/studio/` pour le studio (réutilise `components/`). Thème sombre unique.
- `src/shared/` — config du dépôt, types, parsing des releases, logo pixel-art (partagé avec le générateur d'icône).
- `scripts/modpacks.ts` — les commandes `ranger` et `publier` du studio en ligne de commande.
- `.github/workflows/release-app.yml` — build de l'installeur et release sur tag `app-vX.Y.Z`.
- `build/installer.nsh` — l'installeur ne crée pas de raccourci sur le bureau (l'app le propose au premier lancement,
  réglage `shortcutPrompted`) ; la désinstallation retire celui du bureau, sauf lors d'une mise à jour (`isUpdated`).

## Conventions de publication

- Le dossier de travail du studio fait foi : une release `pack-*` sans zip local est supprimée (avec son tag).
  Seule exception : un modpack ou une version en erreur n'est jamais touché sur GitHub.
- Zip rangé : `<Dossier>-v<N>.zip` (N entier). `pack.json` garde l'`id` (figé), le nom, la description, les notes
  par version et `lastVersion` : un numéro n'est jamais réutilisé.
- Release de modpack : tag `pack-<id>-v<N>`, titre `<nom> v<N>`, fichiers `<id>-<N>.zip` (contenu du dossier
  d'instance, `minecraftinstance.json` à la racine), `modpack.json` (schéma `ModpackManifest`, avec `coverSha256`),
  `cover.(png|jpg|jpeg|webp)` optionnel. Toujours `make_latest: false` (la « latest » reste l'installeur de l'app).
- Release de l'app : tag `app-v<version>` = version de `package.json`, avec l'installeur `.exe`.
- Chaque instance installée contient `.modpack-downloader.json` (id, version, `managedEntries`) : c'est la source
  de vérité pour savoir ce qui est installé.

## Faits CurseForge vérifiés

- CurseForge (Overwolf) pose un file watcher sur le dossier `Instances` et relit chaque `minecraftinstance.json` :
  pas besoin de le redémarrer. Il écrit le chemin du dossier dans ses logs
  (`%LOCALAPPDATA%\Overwolf\Log\Apps\CurseForge\CurseClient\*.json`, « Setting file watcher on instance directory »).
- Lancer CurseForge alors qu'il tourne déjà remet simplement sa fenêtre au premier plan.
- UID Overwolf de CurseForge : `cchhcaiapeikjbdbpfplgmpobbcdkdaphclbmkbj`.

## Pièges connus

- L'extension VS Code définit `ELECTRON_RUN_AS_NODE=1` : Electron démarre alors comme Node et plante
  (`app` undefined). Retirer cette variable pour lancer l'app depuis un outil.
- npm 11 n'exécute que les scripts d'install listés dans `allowScripts` (package.json). Electron télécharge son binaire
  au premier lancement.
- TypeScript est épinglé en 6.x (la 7 est le compilateur natif, pas encore validé ici). archiver 8 est en ESM
  (exports nommés `ZipArchive`). lucide-react v1 n'a plus d'icônes de marques. Tailwind v4 : `px-0!`, `bg-linear-to-r`.
- Tester sans GitHub : un faux serveur de releases (lecture anonyme, écriture avec jeton, `upload_url` et
  téléchargement d'asset par redirection vers lui-même) et `MPD_GITHUB_API=http://localhost:<port>/repos/o/r`
  (+ `GITHUB_TOKEN=x` pour le studio et les scripts). La surcharge est ignorée dans l'app packagée.
- Binaire Electron absent (script d'install bloqué par npm 11) : `node -e "require('electron')"` le télécharge.
- Piloter l'app en test : Playwright `_electron` (installé hors du dépôt). `--user-data-dir=<dossier>` isole les
  données de l'app joueur ; pour le studio, `APPDATA=<dossier>` isole `studio-settings.json` mais le profil Chromium
  va quand même dans le vrai `%APPDATA%\Modpack Studio` (Electron ignore la variable). Mettre un dossier
  `Instances` de test pour ne pas toucher au vrai CurseForge.
- Dans Git Bash, `python3` est le raccourci du Microsoft Store : utiliser `python`.
- Tester un raccourci sans toucher au vrai bureau : `app.evaluate(({ app }, d) => app.setPath('desktop', d), dossier)`
  via Playwright. Le studio force son `userData` dans `%APPDATA%\Modpack Studio` (ignore `--user-data-dir`).
