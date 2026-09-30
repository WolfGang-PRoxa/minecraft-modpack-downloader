# CLAUDE.md

Application Windows (Electron) qui affiche les modpacks Minecraft publiés en releases sur
`WolfGang-PRoxa/minecraft-modpack-downloader` et les installe directement comme profils CurseForge.
Une seule fenêtre, deux vues : la **Bibliothèque** (installer les modpacks) et le **Studio** (ranger ses zips et
publier les releases), réservé aux publieurs. Au premier lancement, l'utilisateur choisit son rôle : **récepteur** (par
défaut) ou **publieur** (dépôt GitHub + compte qui a le droit d'y publier). Changer de rôle change la vue, jamais de
fenêtre ni de processus. Interface et messages en français.

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
npm run studio           # app en développement, ouverte sur la vue Studio (--studio)
npm run modpacks:ranger  # numérote les zips déposés (--dir, --yes)
npm run modpacks:publier # met les releases en accord avec le dossier (--dir, --yes, --dry-run)
npx tsx scripts/generate-icon.ts   # régénère build/icon.png depuis src/shared/logo.ts
```

## Architecture

- `src/main/` — processus principal (un seul, une seule fenêtre)
  - `index.ts` : verrou d'instance, protocole `studio-media:` déclaré avant `ready`, IPC de l'app puis du studio.
    Relancée pendant qu'elle tourne (`second-instance`, éventuellement avec `--studio`) → `app:activated`.
  - `github.ts` : lecture des releases du dépôt suivi (cache ETag sur disque, mode hors ligne), `modpack.json` via
    l'URL publique (hors quota API), mises à jour de l'app toujours lues dans `APP_REPO` (tags `app-v*`).
  - `installer.ts` : téléchargement → vérif SHA-256 → extraction dans un dossier de travail sur le même disque
    que `Instances` → basculement par renommage. Mise à jour sur place en conservant les données du joueur
    (`PLAYER_DATA`) et ses champs de `minecraftinstance.json` (`PRESERVED_INSTANCE_FIELDS`).
  - `curseforge.ts` : détection (protocole `curseforge://` dans `HKCR`, puis chemins connus Overwolf/autonome),
    lancement, dossier `Instances` (réglage > logs CurseForge > défaut), détection de Minecraft lancé.
  - `settings.ts` (Node pur, sans cache) : `settings.json` du `userData` — `role` (`null` = premier lancement),
    `repo`, `workspaceDir` (dossier des modpacks), `lastView` (vue rouverte au lancement)… Lu aussi par les scripts
    (`%APPDATA%\Modpack Downloader\settings.json`).
  - `auth.ts` (Node pur) : connexion GitHub partagée app / scripts. Jeton chiffré par DPAPI via PowerShell
    (`github-auth.json` à côté des réglages, relisible par les scripts). Ordre : connexion faite dans l'app >
    `GITHUB_TOKEN` > `.env` (scripts) > `gh auth token`. Vérifie le droit de publier (`permissions.push`) et gère la
    connexion par code (device flow, `GITHUB_OAUTH_CLIENT_ID`). Canaux `auth:*` (`authIpc.ts`) et `role:*` (`roleIpc.ts`).
  - `githubEnv.ts` : base de l'API d'un dépôt ; `MPD_GITHUB_API` la remplace pour tous les dépôts en test.
  - `shortcut.ts` : raccourci `.lnk` de l'app (bureau ou emplacement choisi). Non packagée : cible
    `electron.exe "<projet>"` et icône `.ico` générée depuis `build/icon.png`.
  - `zip.ts` (yauzl, protection zip-slip, accepte un zip avec dossier racine), `download.ts`, `ipc.ts`, `appUpdate.ts`.
- `src/main/studio/` — la vue Studio. Tout est Node pur (réutilisé par `scripts/modpacks.ts`) sauf `ipc.ts`
  (canaux `studio:*`, images via `studio-media://cover/`, surveillance du dossier des modpacks).
  - `workspace.ts` : lecture du dossier (un sous-dossier par modpack, `pack.json`, `cover.*`), rangement (`planRanger`/`applyRanger`).
  - `analyze.ts` : validation d'un zip (instance CurseForge, refus des exports `manifest.json`), SHA-256, cache `.studio-cache.json`.
  - `sync.ts` : `computePlan` (dossier ↔ releases `pack-*` : create / update / delete) et `applyPlan`.
  - `githubApi.ts` : client d'écriture (dépôt configuré), envois en streaming.
  - `archive.ts` : zip d'une instance (`DEFAULT_EXCLUDES`), `service.ts` : orchestration + verrou d'exclusivité,
    `settings.ts` : dossier des modpacks (repris une fois de l'ancien `%APPDATA%\Modpack Studio\studio-settings.json`).
- `src/preload/index.ts` — un seul preload : `window.api` (`RendererApi`) et `window.studio` (`StudioApi`,
  `src/shared/studio.ts`).
- `src/renderer/` — React 19 + Tailwind v4 + zustand, une seule page (`index.html`). `store.ts` : état de l'app,
  dont `view` (`library` / `studio`, qui suit le rôle : `applyRoleResult`). `src/studio/` : vue Studio (`StudioView`)
  et son store (`useStudio`, notifications et paramètres délégués à l'app). Section « Utilisation » partagée
  `components/Usage.tsx` (premier lancement et paramètres). Thème sombre unique.
- `src/shared/` — config (`APP_REPO`…), types, dépôts (`repo.ts`), parsing des releases, logo pixel-art.
- `scripts/modpacks.ts` — les commandes `ranger` et `publier` du studio en ligne de commande.
- `.github/workflows/release-app.yml` — build de l'installeur et release sur tag `app-vX.Y.Z`. Signature par SignPath
  Foundation (gratuite, open source, licence MIT) si le secret `SIGNPATH_API_TOKEN` existe : envoi de l'installeur
  (artefact), approbation manuelle sur signpath.io, vérification `Get-AuthenticodeSignature`, puis publication.
  Variables `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG` ; configuration
  d'artefact dans `.github/signpath/`. Seul l'installeur est signé (éditeur affiché : SignPath Foundation). La section
  « Politique de signature du code » du README est exigée par SignPath : la garder à jour.
- `build/installer.nsh` — l'installeur ne crée pas de raccourci sur le bureau (l'app le propose au premier lancement,
  réglage `shortcutPrompted`) ; la désinstallation retire celui du bureau, sauf lors d'une mise à jour (`isUpdated`).

## Conventions de publication

- Dépôt des modpacks configurable (`settings.repo`, défaut `APP_REPO`) ; les mises à jour de l'app (`app-v*`) viennent
  toujours d'`APP_REPO`. Le studio refuse de publier si le rôle n'est pas `publisher` (hors scripts, qui publient d'office).
  Après une publication, la bibliothèque est rechargée pour montrer tout de suite les nouvelles versions.
- Le dossier de travail du studio fait foi : une release `pack-*` sans zip local est supprimée (avec son tag).
  Seule exception : un modpack ou une version en erreur n'est jamais touché sur GitHub.
- Zip rangé : `<Dossier>-v<N>.zip` (N entier). `pack.json` garde l'`id` (figé), le nom, la description, les notes
  par version et `lastVersion` : un numéro n'est jamais réutilisé.
- Release de modpack : tag `pack-<id>-v<N>`, titre `<nom> v<N>`, fichiers `<id>-<N>.zip` (contenu du dossier
  d'instance, `minecraftinstance.json` à la racine), `modpack.json` (schéma `ModpackManifest`, `author` = propriétaire
  du dépôt, avec `coverSha256`),
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
- Piloter l'app en test : Playwright `_electron` (installé hors du dépôt). `--user-data-dir=<dossier>` isole ses
  données (réglages, jeton, cache) et son verrou d'instance ; `APPDATA=<dossier>` isole ce que lisent les scripts.
  Mettre un dossier `Instances` de test pour ne pas toucher au vrai CurseForge.
- Dans Git Bash, `python3` est le raccourci du Microsoft Store : utiliser `python`.
- Lucide v1 : pas d'icône GitHub (marques retirées) ; `Avatar` charge `https://github.com/<compte>.png`.
- Tester un raccourci sans toucher au vrai bureau : `app.evaluate(({ app }, d) => app.setPath('desktop', d), dossier)`
  via Playwright.
- `Cover` : le visuel de remplacement ne doit pas cumuler `relative` et le positionnement passé en `className`
  (`absolute inset-0`), sinon il ne remplit pas son cadre.
