# Installation et premier lancement

Cette page explique comment installer Modpack Downloader, ce qui se passe au premier lancement, et comment
désinstaller l’application proprement.

## Installer l’application

1. Installe [CurseForge](https://www.curseforge.com/download/app) si ce n’est pas déjà fait : c’est depuis
   CurseForge que tu lanceras les modpacks.
2. Télécharge **Modpack-Downloader-Setup-x.y.z.exe** depuis la
   [dernière version publiée](https://github.com/WolfGang-PRoxa/minecraft-modpack-downloader/releases/latest).
3. Lance le fichier téléchargé. L’installation prend quelques secondes, sans aucune question, puis l’application
   s’ouvre.

L’application s’installe pour ton compte Windows seulement, **sans droits d’administrateur**, dans
`%LOCALAPPDATA%\Programs\minecraft-modpack-downloader` (soit `C:\Users\<toi>\AppData\Local\Programs\…`). Un raccourci
**Modpack Downloader** est ajouté au menu Démarrer.

> [!NOTE]
> Windows peut afficher « Windows a protégé votre ordinateur » : clique sur **Informations complémentaires**, puis
> **Exécuter quand même**. Cet avertissement de SmartScreen apparaît pour un installeur non signé, et parfois pour
> une nouvelle version signée, le temps que Microsoft la connaisse. Les installeurs signés indiquent l’éditeur
> **SignPath Foundation** (voir [Confidentialité et sécurité](confidentialite.md#signature-de-linstalleur)).

## Le premier lancement

L’écran **Bienvenue dans Modpack Downloader** te demande comment tu vas utiliser l’application :

- **Récepteur** (le choix par défaut) : tu installes les modpacks publiés et tu joues. Clique sur **Continuer** : la
  Bibliothèque s’affiche, avec les modpacks du dépôt `WolfGang-PRoxa/minecraft-modpack-downloader`.
- **Publieur** : tu crées des modpacks et tu les publies sur ton dépôt GitHub. Indique ce dépôt et connecte ton
  compte GitHub, puis clique sur **Devenir publieur** : le Studio s’affiche. Tout est détaillé dans
  [Devenir publieur](publieur.md).

Rien n’est définitif : le rôle et le dépôt suivi se changent à tout moment dans
[Paramètres → Utilisation](parametres.md#utilisation).

> [!TIP]
> Un joueur dont les modpacks sont publiés sur un autre dépôt choisit **Récepteur**, puis indique ce dépôt dans
> [Paramètres → Utilisation → Modpacks de](bibliotheque.md#suivre-les-modpacks-dun-autre-publieur).

## Le raccourci sur le bureau

L’installeur ne pose pas de raccourci sur le bureau : l’application te le propose dans la Bibliothèque, avec le
bandeau **Ajouter un raccourci ?**

- **Ajouter au bureau** crée le raccourci sur ton bureau ;
- **Ailleurs…** te laisse choisir l’emplacement (un dossier, une clé USB…) ;
- **Non merci** ferme le bandeau pour de bon.

Tu peux créer ou recréer le raccourci plus tard dans [Paramètres → Raccourci](parametres.md#raccourci). Recréer le
raccourci répare aussi une icône restée vide.

## Lancer l’application

Lance Modpack Downloader depuis le menu Démarrer ou depuis ton raccourci. La fenêtre s’ouvre en grand, la barre des
tâches restant visible ; `F11` passe en plein écran.

L’application ne s’ouvre qu’une fois : la relancer alors qu’elle tourne déjà ramène simplement sa fenêtre au premier
plan. Un publieur retrouve la dernière vue utilisée (Bibliothèque ou Studio).

## Relancer l’installeur

Si tu relances un installeur alors que l’application est déjà installée, il le détecte et s’adapte :

| Application déjà installée | Ce que fait l’installeur |
|---|---|
| La même version | Il propose de l’ouvrir. **Oui** l’ouvre, **Non** la réinstalle, **Annuler** ne fait rien. |
| Une version plus récente | Il prévient avant un retour en arrière. **Oui** ouvre la version installée, **Non** revient à la version de l’installeur, **Annuler** ne fait rien. |
| Une version plus ancienne | Il la met à jour, sans question. |

Une installation abîmée (fichiers de l’application supprimés à la main) est simplement réinstallée. En mode
silencieux (`/S`), l’installeur ne pose aucune question.

Tes réglages, ta connexion GitHub et tes modpacks ne sont jamais touchés par une réinstallation.

## Désinstaller

Ouvre **Paramètres Windows → Applications → Applications installées**, cherche **Modpack Downloader**, puis
**Désinstaller**. Le raccourci du bureau est retiré avec l’application (un raccourci créé ailleurs reste à
supprimer à la main).

La désinstallation laisse en place :

- **tes modpacks** : ce sont des profils CurseForge comme les autres, toujours jouables ;
- **tes réglages et ta connexion GitHub**, dans `%APPDATA%\Modpack Downloader` : supprime ce dossier pour ne rien
  laisser derrière toi (et pour effacer le jeton GitHub enregistré) ;
- pour un publieur, **le dossier des modpacks** et les releases publiées sur GitHub.

Le détail de chaque fichier est dans [Fichiers et dossiers](fichiers.md).
