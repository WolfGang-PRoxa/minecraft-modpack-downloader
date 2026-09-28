# Modpack Downloader

Application Windows pour installer en un clic les modpacks Minecraft publiés sur ce dépôt.
Le modpack apparaît directement dans CurseForge, prêt à être lancé.

## Pour les joueurs

1. Installe [CurseForge](https://www.curseforge.com/download/app) si ce n'est pas déjà fait.
2. Télécharge **Modpack-Downloader-Setup-x.y.z.exe** depuis la dernière release
   [« Modpack Downloader »](https://github.com/WolfGang-PRoxa/minecraft-modpack-downloader/releases/latest) et lance-le.
   Si Windows affiche « Windows a protégé votre ordinateur », clique sur **Informations complémentaires**,
   puis **Exécuter quand même** (l'application n'est pas signée).
3. Dans l'application, clique sur **Installer**. CurseForge s'ouvre et le modpack est dans l'onglet Minecraft.

Quand une nouvelle version d'un modpack sort, le bouton devient **Mettre à jour**. Tes mondes, tes options,
tes captures d'écran et tes packs de ressources sont conservés.

`F11` : passer du plein écran à une fenêtre.

## Publier un modpack

Prérequis, une seule fois :

- le dépôt doit être **public** (sinon les joueurs ne voient rien) et avoir au moins un commit ;
- un jeton GitHub *fine-grained* avec l'accès **Contents : Read and write** sur ce dépôt
  ([créer un jeton](https://github.com/settings/personal-access-tokens/new)). Le script le demande au premier
  lancement et peut l'enregistrer dans `.env` (ignoré par git).

Ensuite, à chaque publication :

```bash
npm install          # la première fois
npm run publish:modpack
```

Le script liste tes instances CurseForge, propose la version suivante, ouvre un éditeur pour les notes de version
(Markdown), zippe l'instance, puis crée la release avec le zip, `modpack.json` et l'image de couverture.

Ne sont **pas** publiés : `saves`, `screenshots`, `logs`, `crash-reports`, `backups`, les données de minimap…
(`--include-saves` pour livrer un monde, `--exclude <chemin>` pour exclure autre chose).

Options utiles :

```bash
npm run publish:modpack -- --instance "C:\Users\...\curseforge\minecraft\Instances\Mon Pack" --version 1.2.0 --notes-file notes.md --cover cover.png
npm run publish:modpack -- --dry-run --out ./modpack-out   # génère les fichiers sans rien publier
```

Taille maximale d'un zip : 2 Go (limite de GitHub par fichier).

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
