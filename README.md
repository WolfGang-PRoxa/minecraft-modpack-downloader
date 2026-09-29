# Modpack Downloader

Application Windows pour installer en un clic les modpacks Minecraft publiés sur ce dépôt.
Le modpack apparaît directement dans CurseForge, prêt à être lancé.

## Pour les joueurs

1. Installe [CurseForge](https://www.curseforge.com/download/app) si ce n'est pas déjà fait.
2. Télécharge **Modpack-Downloader-Setup-x.y.z.exe** depuis la dernière release
   [« Modpack Downloader »](https://github.com/WolfGang-PRoxa/minecraft-modpack-downloader/releases/latest) et lance-le.
   Si Windows affiche « Windows a protégé votre ordinateur », clique sur **Informations complémentaires**,
   puis **Exécuter quand même** (l'application n'est pas signée).
3. Au premier lancement, l'application propose d'ajouter un raccourci sur ton bureau (ou à l'endroit de ton
   choix, bouton **Ailleurs…**). C'est aussi possible plus tard dans les paramètres.
4. Dans l'application, clique sur **Installer**. CurseForge s'ouvre et le modpack est dans l'onglet Minecraft.

Quand une nouvelle version d'un modpack sort, le bouton devient **Mettre à jour**. Tes mondes, tes options,
tes captures d'écran et tes packs de ressources sont conservés.

`F11` : passer du plein écran à une fenêtre.

## Publier un modpack : Modpack Studio

Le studio est l'outil de l'auteur : on y dépose les zips de chaque mise à jour, il les numérote et met les
releases GitHub en accord avec le dossier, en quelques clics.

Prérequis, une seule fois :

- le dépôt doit être **public** (sinon les joueurs ne voient rien) ;
- une connexion à GitHub : si [GitHub CLI](https://cli.github.com/) est connecté (`gh auth login`), il n'y a rien
  d'autre à faire. Sinon, colle dans les paramètres du studio un jeton *fine-grained* limité à ce dépôt avec l'accès
  **Contents : Read and write** ([créer un jeton](https://github.com/settings/personal-access-tokens/new)).

```bash
npm install          # la première fois
npm run studio
```

Dans les paramètres du studio, **Ajouter au bureau** crée un raccourci pour l'ouvrir ensuite d'un double-clic,
sans terminal (il lance la dernière version compilée : refais `npm run build` après une mise à jour du code).

Au premier lancement, choisis le dossier des modpacks (par défaut `C:\Users\<toi>\Modpacks`). Il contient un
sous-dossier par modpack :

```
Modpacks/
  Hardcore_Endgame/
    Hardcore_Endgame-v1.zip        ← zips rangés (numérotés)
    Hardcore_Endgame-v2.zip
    ma-derniere-maj.zip            ← zip déposé, pas encore rangé
    cover.png                      ← image de couverture (facultatif, 16:9)
    pack.json                      ← géré par le studio : nom, description, notes de version
  Autre_Modpack/
```

À chaque mise à jour d'un modpack :

1. **Dépose le zip** dans son dossier (Explorateur, ou glisser-déposer sur le modpack dans le studio). Le bouton
   **Créer la vN depuis CurseForge** zippe directement une instance, sans tes mondes, logs ni captures.
2. **Ranger les zips** : chaque nouveau zip reçoit le numéro suivant (`Hardcore_Endgame-v3.zip`), du plus ancien
   au plus récent. L'ordre se modifie dans l'aperçu.
3. **Notes** (facultatif) : les nouveautés de la version, en Markdown, affichées aux joueurs.
4. **Publier sur GitHub** : le studio affiche ce qui va changer, puis l'applique après confirmation.

Le dossier fait foi, GitHub en est le miroir :

| Sur le PC | Sur GitHub à la publication |
|---|---|
| nouveau zip rangé | nouvelle release `pack-<id>-v<N>` (zip, `modpack.json`, image) |
| zip, image, nom, description ou notes modifiés | release mise à jour |
| zip supprimé | release **supprimée**, avec son tag |
| dossier du modpack supprimé | toutes ses releases **supprimées** |

- Un numéro n'est **jamais réutilisé** : après suppression de la v3, le zip suivant devient la v4. Sinon, un joueur
  qui a l'ancienne v3 croirait être à jour.
- Remplacer le contenu d'un zip déjà publié met la release à jour, mais les joueurs qui ont déjà cette version ne sont
  pas prévenus : préfère déposer un nouveau zip.
- Un zip doit contenir le **dossier de l'instance CurseForge** (`minecraftinstance.json` à la racine ou dans un
  dossier) et peser au plus 2 Go. Un export CurseForge (`manifest.json` + `overrides`) est refusé, comme un zip
  illisible ou en cours de copie : il n'est ni rangé ni publié.
- Un modpack en erreur (`pack.json` invalide, deux zips pour le même numéro…) est laissé tel quel sur GitHub
  jusqu'à correction. Les releases de l'application (`app-v*`) ne sont jamais touchées.

Les mêmes opérations existent en ligne de commande, sur le dossier choisi dans le studio :

```bash
npm run modpacks:ranger                     # numérote les zips déposés
npm run modpacks:publier                    # met GitHub en accord avec le dossier
npm run modpacks:publier -- --dry-run       # affiche seulement ce qui changerait
# options : --dir <dossier>, --yes (sans confirmation)
```

Les scripts utilisent `GITHUB_TOKEN`, un fichier `.env` (`GITHUB_TOKEN=…`, ignoré par git) ou la session GitHub CLI.

## Publier une nouvelle version de l'application

1. Modifier `version` dans `package.json` (ex. `1.1.0`) et committer.
2. Pousser un tag `app-v1.1.0` :

   ```bash
   git tag app-v1.1.0
   git push origin app-v1.1.0
   ```

GitHub Actions construit l'installeur et crée la release. Les applications déjà installées affichent un bandeau
« Nouvelle version » et se mettent à jour en un clic.

## Développement

```bash
npm install
npm run dev          # lance l'application avec rechargement à chaud
npm run studio       # lance le Modpack Studio (même application, option --studio)
npm run typecheck
npm run build:win    # installeur local dans dist/
```

Le dépôt interrogé est défini dans `src/shared/config.ts`.

### Comment ça marche

- Les modpacks sont les releases dont le tag suit `pack-<id>-v<version>`, avec un zip du dossier d'instance
  CurseForge et un `modpack.json` (nom, version Minecraft, mod loader, empreinte SHA-256…).
- L'application télécharge le zip, vérifie son empreinte, l'extrait dans un dossier temporaire puis le place dans
  le dossier `Instances` de CurseForge en adaptant les chemins de `minecraftinstance.json`. CurseForge surveille
  ce dossier et affiche le nouveau profil immédiatement.
- Le dossier `Instances` est détecté automatiquement (y compris s'il a été déplacé dans CurseForge) et peut être
  changé dans les paramètres de l'application.
- Le studio compare chaque zip local (empreinte SHA-256, gardée en cache dans `.studio-cache.json`) au
  `modpack.json` de la release correspondante, et ne renvoie que ce qui a changé. Une release est créée en brouillon
  et n'apparaît qu'une fois tous ses fichiers envoyés ; un fichier remplacé est d'abord envoyé sous un autre nom,
  puis échangé, pour que la release ne soit jamais incomplète.
