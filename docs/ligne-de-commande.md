# En ligne de commande

Les deux opérations principales du Studio, ranger les zips et publier, existent aussi en ligne de commande. Elles
travaillent sur le même dossier, le même dépôt et la même connexion GitHub que l’application : tu peux passer de
l’une à l’autre librement.

## Prérequis

Les commandes s’exécutent depuis le code source de l’application :

1. installe [Node.js](https://nodejs.org/) (version 24) et [Git](https://git-scm.com/) ;
2. récupère le code : `git clone https://github.com/WolfGang-PRoxa/minecraft-modpack-downloader.git` ;
3. dans le dossier obtenu, installe les dépendances : `npm install`.

## Les commandes

```bash
npm run modpacks:ranger                  # numérote les zips déposés
npm run modpacks:publier                 # met GitHub en accord avec le dossier
npm run modpacks:publier -- --dry-run    # affiche seulement ce qui changerait
```

**`modpacks:ranger`** affiche, modpack par modpack, les zips à renommer (`ma-maj.zip → Hardcore_Endgame-v3.zip`) et
les zips refusés, puis demande confirmation. Les zips sont numérotés du plus ancien au plus récent ; pour un autre
ordre, utilise le Studio.

**`modpacks:publier`** relit GitHub, affiche les changements (`+` nouvelle version, `~` mise à jour, `−` suppression)
avec leur détail et la quantité de données à envoyer, puis demande confirmation. La réponse par défaut est **non**
quand des releases seraient supprimées. Pendant l’envoi, une barre suit chaque fichier ; `Ctrl` + `C` arrête la
publication proprement.

## Les options

| Option | Effet |
|---|---|
| `--dir <dossier>` | Dossier des modpacks à utiliser. |
| `--repo <propriétaire/dépôt>` | Dépôt GitHub sur lequel publier. |
| `--yes`, `-y` | Ne demande pas de confirmation. |
| `--dry-run` | (`publier`) Affiche les changements sans rien publier. |

Les options se placent après `--` : `npm run modpacks:publier -- --dir D:\Modpacks --yes`.

## Dossier, dépôt et connexion

**Le dossier des modpacks** est, dans cet ordre : celui de l’option `--dir`, celui de la variable d’environnement
`MODPACKS_DIR`, celui choisi dans le Studio, et enfin `C:\Users\<toi>\Modpacks` s’il existe.

**Le dépôt** est celui de l’option `--repo`, sinon celui choisi dans l’application
(**Paramètres → Utilisation**).

**La connexion GitHub** est la première trouvée parmi :

1. la connexion faite dans l’application ;
2. la variable d’environnement `GITHUB_TOKEN` ;
3. un fichier `.env` dans le dossier courant, contenant `GITHUB_TOKEN=…` (ignoré par git) ;
4. la session GitHub CLI (`gh auth login`).

## Différences avec le Studio

- Les commandes publient **quel que soit le rôle** choisi dans l’application : ce sont des outils d’auteur.
- Elles ne suppriment rien sur ton PC : pour supprimer une version, supprime son zip puis lance
  `modpacks:publier`, qui retire sa release.
- Le choix de l’ordre des zips à ranger, les notes de version et l’image se font dans le Studio (ou en modifiant
  `pack.json` et `cover.png` à la main).

`npm run studio` lance l’application depuis le code source, directement sur le Studio.
