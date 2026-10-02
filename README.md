# Modpack Downloader

Application Windows pour installer en un clic les modpacks Minecraft publiés sur ce dépôt.
Le modpack apparaît directement dans CurseForge, prêt à être lancé.

## Pour les joueurs

1. Installe [CurseForge](https://www.curseforge.com/download/app) si ce n'est pas déjà fait.
2. Télécharge **Modpack-Downloader-Setup-x.y.z.exe** depuis la dernière release
   [« Modpack Downloader »](https://github.com/WolfGang-PRoxa/minecraft-modpack-downloader/releases/latest) et lance-le.
   Les installeurs signés indiquent l'éditeur **SignPath Foundation** (voir
   [Politique de signature du code](#politique-de-signature-du-code)). Si Windows affiche « Windows a protégé votre
   ordinateur », clique sur **Informations complémentaires**, puis **Exécuter quand même** : cet avertissement
   apparaît pour un installeur non signé, et parfois pour une nouvelle version signée, le temps que Microsoft la
   connaisse.
3. Au premier lancement, choisis **Récepteur** (le choix par défaut) : tu reçois les modpacks publiés sur ce dépôt.
   L'application propose ensuite d'ajouter un raccourci sur ton bureau (ou à l'endroit de ton choix, bouton
   **Ailleurs…**). Rôle, dépôt suivi et raccourci se changent à tout moment dans les paramètres : l'interface
   suit le rôle, dans la même fenêtre.
4. Dans l'application, clique sur **Installer**. CurseForge s'ouvre et le modpack est dans l'onglet Minecraft.

Quand une nouvelle version d'un modpack sort, le bouton devient **Mettre à jour**. Tes mondes, tes options,
tes captures d'écran et tes packs de ressources sont conservés.

L'application indique aussi ce que tu as déjà : **v2 dans ton CurseForge**, même si ce n'est pas la dernière
version, et marque cette version dans l'historique. Elle le sait pour les profils qu'elle a installés, et reconnaît
les autres (zip importé à la main, profil d'origine du publieur…) à leurs mods : un profil qui contient exactement
les mêmes fichiers `.jar` qu'une version publiée est cette version. Elle ne modifie jamais un profil qu'elle n'a
pas installé : **Installer** crée alors un profil à part.

Si tu relances l'installeur alors que l'application est déjà installée, il le détecte et te propose simplement de
l'ouvrir (ou de la réinstaller) au lieu de tout réinstaller. Un installeur plus récent met à jour sans question ; un
installeur plus ancien te prévient avant de revenir en arrière.

L'application s'installe pour ton compte Windows, sans droits d'administrateur, dans
`%LOCALAPPDATA%\Programs\minecraft-modpack-downloader` (soit `C:\Users\<toi>\AppData\Local\Programs\…`), avec un
raccourci dans le menu Démarrer. Tes réglages sont dans `%APPDATA%\Modpack Downloader` ; les modpacks, eux, vont
dans le dossier `Instances` de CurseForge. Pour la désinstaller : **Paramètres Windows → Applications**.

### Mises à jour de l'application

Quand une nouvelle version de l'application sort, une barre l'annonce **en haut de la fenêtre**, quelle que soit la
vue. **Mettre à jour** télécharge le nouvel installeur et vérifie son empreinte ; l'application se ferme, s'installe
et se relance toute seule dans la nouvelle version, sans rien te demander. Tes réglages, ta connexion GitHub et tes
modpacks ne bougent pas. **Plus tard** replie la barre en un rappel dans la barre de titre, jusqu'au prochain
lancement.

L'application regarde s'il existe une nouvelle version à chaque lancement, puis toutes les 30 minutes tant qu'elle
reste ouverte ; **Paramètres → À propos → Rechercher une mise à jour** le fait tout de suite. Pour ne rien
interrompre, la mise à jour ne démarre pas pendant l'installation d'un modpack ou une publication : termine d'abord
l'opération en cours.

### Signaler un problème

Le bouton en forme d'insecte, en haut à droite, ouvre un formulaire : un problème ou une suggestion, un titre, une
description, et le modpack concerné s'il y en a un. Les informations techniques jointes (version de l'application et
de Windows, état de CurseForge) sont affichées avant l'envoi et ne contiennent ni chemin ni nom de compte.

- Si un compte GitHub est connecté dans l'application, le signalement devient directement une issue de ce dépôt.
- Sinon, ton navigateur s'ouvre sur GitHub avec le signalement déjà rempli : il reste à cliquer sur « Create ».

Dans les deux cas le signalement est public : n'y mets rien de personnel.

`F11` : passer du plein écran à une fenêtre.

## Publier un modpack : le Studio

Le Studio est la vue du publieur, dans la même fenêtre que la bibliothèque : on y dépose les zips de chaque mise à
jour, il les numérote et met les releases GitHub en accord avec le dossier, en quelques clics.

Devenir publieur (au premier lancement, ou dans **Paramètres → Utilisation**) :

1. Indique le dépôt GitHub des modpacks (`propriétaire/dépôt`). Il doit être **public**, sinon les joueurs ne voient
   rien. Par défaut : `WolfGang-PRoxa/minecraft-modpack-downloader`.
2. Connecte le compte GitHub qui possède ce dépôt : l'application vérifie qu'il a le droit d'y publier, ce qui atteste
   qu'il s'agit bien de toi. Si une session existe déjà sur le PC ([GitHub CLI](https://cli.github.com/) connecté,
   ou variable `GITHUB_TOKEN`), elle est utilisée d'office. Sinon : **Se connecter avec GitHub**, ou un jeton
   *fine-grained* limité au dépôt avec l'accès **Contents : Read and write**
   ([créer un jeton](https://github.com/settings/personal-access-tokens/new)), chiffré par Windows.
3. L'application passe sur le **Studio**. Les onglets **Bibliothèque** et **Studio**, en haut, permettent de
   passer de l'un à l'autre ; l'application rouvre la dernière vue utilisée. Repasser en récepteur ramène à la
   bibliothèque et retire l'onglet Studio.

Les récepteurs suivent par défaut le dépôt `WolfGang-PRoxa/minecraft-modpack-downloader`. Si tu publies sur un autre
dépôt, tes joueurs le choisissent dans **Paramètres → Utilisation → Modpacks de**.

Depuis le code source, `npm run studio` lance l'application directement sur le Studio (`npm install` la première
fois).

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

Le Studio dit aussi quelle version se trouve dans ton CurseForge : « Ton CurseForge contient la **v3** (profil
« Hardcore Endgame »), en ligne sur GitHub », et la ligne de cette version porte la pastille **Dans ton
CurseForge**. Tu vois ainsi d'un coup d'œil si ce que tu as sous la main est déjà publié. La reconnaissance se fait
sur les mods (nom et taille de chaque `.jar`) : après un changement de configuration seul, le profil est toujours
reconnu comme la même version — dépose quand même un nouveau zip pour le publier.

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

Les scripts publient sur le dépôt choisi dans l'application (ou `--repo propriétaire/dépôt`), avec la connexion faite
dans l'application, sinon `GITHUB_TOKEN`, un fichier `.env` (`GITHUB_TOKEN=…`, ignoré par git) ou la session GitHub CLI.

## Publier une nouvelle version de l'application

1. Modifier `version` dans `package.json` (ex. `1.1.0`) et committer.
2. Pousser un tag `app-v1.1.0` :

   ```bash
   git tag app-v1.1.0
   git push origin app-v1.1.0
   ```

GitHub Actions construit l'installeur, le fait signer (voir ci-dessous) et crée la release. Les applications déjà
installées proposent alors la nouvelle version en haut de leur fenêtre et se mettent à jour en un clic (voir
[Mises à jour de l'application](#mises-à-jour-de-lapplication)).

### Suivi des signalements (mainteneur)

Le dossier [`relay/`](relay/README.md) contient un petit service, hébergé sur Netlify, qui prévient le propriétaire
du dépôt par mail à chaque issue et lui permet, depuis les boutons de ses mails, de faire corriger l'issue puis de
valider ou d'invalider la correction proposée. Rien n'est fusionné sur la branche principale sans sa validation.

### Signature du code (mainteneur)

L'installeur est signé gratuitement par [SignPath Foundation](https://signpath.org), réservé aux projets open source.
Tant que la signature n'est pas configurée, la CI publie l'installeur sans signature.

Mise en place, une seule fois :

1. Prérequis de SignPath Foundation : licence open source ([MIT](LICENSE)), double authentification activée sur
   GitHub et sur SignPath, et une première release de l'application déjà publiée (`app-v1.0.0`, non signée).
2. Candidater sur [signpath.org](https://signpath.org/apply) avec l'adresse du dépôt.
3. Une fois le projet créé chez SignPath : installer l'application GitHub de SignPath sur le dépôt, lier le
   *Trusted Build System* « GitHub.com » au projet, définir comme configuration d'artefact par défaut le contenu de
   [`.github/signpath/artifact-configuration.xml`](.github/signpath/artifact-configuration.xml), et créer un jeton d'API
   pour un utilisateur autorisé à soumettre des demandes.
4. Dans GitHub → *Settings* → *Secrets and variables* → *Actions* : le secret `SIGNPATH_API_TOKEN` et les variables
   `SIGNPATH_ORGANIZATION_ID`, `SIGNPATH_PROJECT_SLUG` et `SIGNPATH_SIGNING_POLICY_SLUG` (en général
   `release-signing`).

À chaque tag `app-v*`, la CI envoie l'installeur à SignPath et attend : approuve la demande sur signpath.io (un e-mail
te prévient). L'installeur signé est ensuite vérifié puis publié. Seul l'installeur est signé : c'est le fichier que
Windows contrôle au téléchargement.

## Politique de signature du code

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by
[SignPath Foundation](https://signpath.org).
(Signature gratuite fournie par SignPath.io, certificat de la SignPath Foundation.)

Rôles :

- **Auteurs** (modifient le code sans relecture) : [WolfGang-PRoxa](https://github.com/WolfGang-PRoxa)
- **Relecteurs** (relisent les contributions extérieures) : [WolfGang-PRoxa](https://github.com/WolfGang-PRoxa)
- **Approbateurs** (autorisent la signature de chaque version) : [WolfGang-PRoxa](https://github.com/WolfGang-PRoxa)

Seuls les installeurs construits par GitHub Actions à partir de ce dépôt sont signés, après approbation manuelle.

### Confidentialité

Modpack Downloader ne collecte aucune donnée et n'envoie rien à ses auteurs de lui-même. Il ne contacte que GitHub
(`api.github.com`, `github.com` et ses serveurs de fichiers) : pour lister les modpacks et les mises à jour du dépôt
suivi, télécharger les fichiers que tu choisis d'installer et afficher les avatars des comptes. En mode publieur, la
connexion GitHub (jeton) reste chiffrée sur ton PC et n'est envoyée qu'à GitHub, pour publier sur le dépôt choisi.
Un signalement n'est envoyé que si tu remplis et valides le formulaire « Signaler un problème » : il devient alors
une issue publique de ce dépôt, avec ce que tu as écrit et, si tu les joins, les informations techniques affichées
dans le formulaire.
Aucune autre information n'est transmise à un autre système.

## Développement

```bash
npm install
npm run dev          # lance l'application avec rechargement à chaud
npm run studio       # même chose, ouverte sur la vue Studio (option --studio)
npm run typecheck
npm run build:win    # installeur local dans dist/
```

Le dépôt de l'application (mises à jour, source des modpacks par défaut) est défini dans `src/shared/config.ts`
(`APP_REPO`), comme l'identifiant de l'application OAuth GitHub (`GITHUB_OAUTH_CLIENT_ID`) utilisée par
« Se connecter avec GitHub ».

Licence : [MIT](LICENSE).

### Comment ça marche

- Les modpacks sont les releases dont le tag suit `pack-<id>-v<version>`, avec un zip du dossier d'instance
  CurseForge et un `modpack.json` (nom, version Minecraft, mod loader, empreinte SHA-256…).
- `modpack.json` contient aussi l'empreinte des mods de la version (`modsSignature` : nom et taille de chaque `.jar`
  du dossier `mods`). L'application calcule la même empreinte pour chaque profil du dossier `Instances` : c'est ce
  qui lui permet de dire qu'une version est déjà dans CurseForge sans l'avoir installée elle-même. Une version
  publiée avant cette fonction n'a pas d'empreinte : le Studio propose de la compléter (seul `modpack.json` est
  renvoyé, pas le zip).
- L'application télécharge le zip, vérifie son empreinte, l'extrait dans un dossier temporaire puis le place dans
  le dossier `Instances` de CurseForge en adaptant les chemins de `minecraftinstance.json`. CurseForge surveille
  ce dossier et affiche le nouveau profil immédiatement.
- Le dossier `Instances` est détecté automatiquement (y compris s'il a été déplacé dans CurseForge) et peut être
  changé dans les paramètres de l'application.
- Les versions de l'application sont les releases `app-v<version>` de ce dépôt, quel que soit le dépôt de modpacks
  suivi. Pour se mettre à jour, l'application télécharge l'installeur de la plus récente, compare son empreinte
  SHA-256 à celle que GitHub publie pour ce fichier, puis le lance avec `--updated` et se ferme : l'installeur
  remplace les fichiers et relance l'application.
- Le studio compare chaque zip local (empreinte SHA-256, gardée en cache dans `.studio-cache.json`) au
  `modpack.json` de la release correspondante, et ne renvoie que ce qui a changé. Une release est créée en brouillon
  et n'apparaît qu'une fois tous ses fichiers envoyés ; un fichier remplacé est d'abord envoyé sous un autre nom,
  puis échangé, pour que la release ne soit jamais incomplète.
