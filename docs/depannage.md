# Dépannage

Cette page reprend les messages que l’application peut afficher, avec leur cause et la marche à suivre. Utilise la
recherche de l’aide (`Ctrl` + `K`) avec quelques mots du message.

## Installation de l’application

**« Windows a protégé votre ordinateur »**\
SmartScreen ne connaît pas encore cet installeur. Clique sur **Informations complémentaires**, puis **Exécuter
quand même**. Télécharge toujours l’installeur depuis la
[page officielle des versions](https://github.com/WolfGang-PRoxa/minecraft-modpack-downloader/releases).

**« Une version plus récente de Modpack Downloader est déjà installée sur ce PC »**\
Tu lances un installeur plus ancien que la version installée. **Oui** ouvre la version installée ; **Non** revient
à la version de l’installeur.

**L’application ne s’ouvre pas**\
Elle est peut-être déjà ouverte, réduite ou derrière une autre fenêtre : la relancer ramène sa fenêtre au premier
plan. Sinon, relance l’installeur : il réinstalle une installation abîmée.

## CurseForge

**« CurseForge introuvable »** ou **« CurseForge n’est pas installé sur ce PC. Installe-le puis réessaie. »**\
L’application ne trouve ni la version Overwolf, ni l’application autonome de CurseForge.
[Installe CurseForge](https://www.curseforge.com/download/app), puis reviens sur la fenêtre de l’application.

**Le modpack installé n’apparaît pas dans CurseForge, ou CurseForge affiche « 404 »**\
CurseForge était ouvert pendant l’installation ou la mise à jour : il ne relit ses profils qu’au démarrage. Clique
sur **Relancer CurseForge** dans la notification, ou dans **Paramètres → CurseForge**. Voir
[Quand CurseForge était déjà ouvert](curseforge.md#quand-curseforge-était-déjà-ouvert).

**Le modpack n’apparaît toujours pas après la relance**\
L’application installe peut-être dans un autre dossier que celui de CurseForge. Compare le dossier de
**Paramètres → Dossier des instances** avec celui des paramètres Minecraft de CurseForge ; le bouton **Modifier…**
permet de choisir le bon.

**« Minecraft est lancé depuis CurseForge : ferme le jeu, puis relance CurseForge. »**\
La relance est refusée pendant une partie. Quitte Minecraft, puis recommence.

**« CurseForge ne s’est pas fermé : ferme-le à la main, puis rouvre-le. »**\
CurseForge n’a pas répondu à la demande de fermeture. Ferme-le depuis sa fenêtre ou depuis l’icône de la zone de
notification (en bas à droite de l’écran), puis rouvre-le.

## Installation d’un modpack

**« Minecraft est lancé avec ce modpack. Ferme le jeu puis réessaie. »**\
La mise à jour d’un profil est refusée pendant qu’une partie tourne avec lui. Quitte le jeu, puis recommence.

**« Le fichier téléchargé est corrompu (empreinte SHA-256 différente). Réessaie. »**\
Le zip reçu ne correspond pas à celui publié : téléchargement abîmé, ou fichier remplacé sur GitHub entre-temps.
Actualise la liste, puis réessaie.

**« Le téléchargement a été interrompu avant la fin. »** ou **« Connexion à GitHub impossible. Vérifie ta connexion internet. »**\
La connexion a été coupée pendant le téléchargement. Vérifie ta connexion, puis réessaie : l’installation repart du
début, sans rien laisser derrière elle.

**« Téléchargement impossible (HTTP 404). »**\
La version a été retirée ou remplacée sur GitHub depuis la dernière lecture de la liste. Clique sur **Actualiser**,
puis réessaie.

**« Espace disque insuffisant pour installer ce modpack. »**\
Libère de la place sur le disque de ton dossier `Instances` et sur celui de Windows (le zip est d’abord téléchargé
dans le dossier temporaire de Windows).

**« Un fichier du modpack est utilisé par un autre programme. Ferme Minecraft et réessaie. »**\
Un fichier du profil est ouvert ailleurs : Minecraft, une fenêtre de l’Explorateur, un éditeur, ou un antivirus en
train de l’analyser. Ferme ce qui peut l’utiliser, puis réessaie.

**« La mise à jour a échoué (…). Aucune donnée n’a été supprimée : … »**\
La mise à jour s’est arrêtée en cours de route. Le profil a été remis en place si possible, et le dossier indiqué à
la fin du message contient tout ce qui avait été déplacé, y compris tes mondes (dans `old` et `new`). Récupère ce
dont tu as besoin, puis supprime ce dossier.

**« Archive invalide : minecraftinstance.json est introuvable. »** ou **« … est illisible. »**\
Le zip publié ne contient pas une instance CurseForge valide. Le publieur doit corriger sa version :
[signale-le](signalement.md).

**« Chemin invalide dans l’archive : … »**\
Le zip contient un chemin qui sortirait du dossier du profil : l’installation est refusée par sécurité. Signale-le
au publieur.

**« Une installation est déjà en cours. »**\
Une seule installation se fait à la fois : attends la fin de la précédente.

**« Patiente : la mise à jour de l’application est en cours. »**\
L’application va redémarrer pour se mettre à jour : relance l’installation après son redémarrage.

## Liste des modpacks

**« Limite de requêtes GitHub atteinte. Réessaie après 14:05. »**\
Sans compte, GitHub limite à 60 le nombre de lectures par heure depuis une même adresse IP (toutes les applications
et tous les PC de ta connexion internet comptent). Attends l’heure indiquée : en attendant, la dernière liste
connue reste affichée.

**« Impossible de joindre GitHub. Vérifie ta connexion internet. »**\
Pas de connexion, ou GitHub est indisponible. La dernière liste connue reste affichée, avec **Réessayer**.

**« Dépôt … introuvable (il doit être public). »**\
Le dépôt suivi n’existe plus, a été renommé ou est devenu privé. Vérifie son nom dans
**Paramètres → Utilisation**, ou reviens au dépôt par défaut.

**« GitHub a répondu 502 Bad Gateway. »** (ou un autre code)\
GitHub rencontre un problème passager. Réessaie dans quelques minutes.

**« Aucun modpack pour le moment »**\
Le dépôt suivi ne contient encore aucun modpack publié. Vérifie que tu suis le bon dépôt.

## Mise à jour de l’application

**« Mise à jour reportée — Patiente : … est en cours. »**\
Une installation de modpack ou une opération du Studio est en cours. Attends sa fin, puis clique à nouveau sur
**Mettre à jour**.

**« L’installeur téléchargé ne correspond pas à celui publié sur GitHub. Réessaie. »**\
Le téléchargement a été abîmé : l’installeur n’est pas lancé. Réessaie.

**« Espace disque insuffisant pour télécharger la mise à jour. »**\
Libère de la place sur le disque de Windows, puis réessaie.

**« Connexion à GitHub interrompue. Vérifie ta connexion internet. »**\
Le téléchargement a été coupé. Réessaie une fois la connexion rétablie.

**« L’installeur n’a pas pu être lancé (…). »**\
Un antivirus a peut-être bloqué l’installeur. Utilise **Télécharger depuis GitHub**, puis lance l’installeur toi-même.

## Compte GitHub

**« GitHub refuse la connexion enregistrée (jeton expiré ou révoqué) : reconnecte-toi. »**\
Ton jeton a expiré ou a été supprimé sur GitHub. Crée-en un nouveau et colle-le dans **Paramètres → Utilisation →
Compte GitHub** (voir [Créer un jeton GitHub](publieur.md#créer-un-jeton-github)).

**« Le compte … n’a pas le droit de publier sur … »** ou **« Ce compte GitHub ne peut pas publier sur … »**\
Le compte connecté n’est ni propriétaire ni collaborateur du dépôt, ou son jeton n’a pas l’accès
**Contents : Read and write** à ce dépôt. Connecte le bon compte, ou crée un jeton avec cet accès.

**« Dépôt … introuvable pour le compte … »**\
Le nom du dépôt est mal saisi, ou le compte connecté n’y a pas accès. Vérifie le nom, ou connecte-toi avec le
compte propriétaire.

**« Connecte-toi à GitHub pour prouver que tu peux publier sur ce dépôt. »**\
Aucune connexion GitHub n’a été trouvée : connecte ton compte dans le formulaire.

## Studio et publication

**« Le dossier ou GitHub a changé depuis l’aperçu : vérifie la nouvelle liste puis relance. »**\
Un fichier a changé dans le dossier, ou quelqu’un a modifié les releases, pendant que l’aperçu était ouvert. Rien
n’a été publié : relis la liste mise à jour et relance.

**« Patiente : … est en cours. »**\
Une autre opération du Studio (publication, rangement, suppression, création de zip) ou la mise à jour de
l’application est en cours. Attends sa fin.

**« Un fichier est utilisé par un autre programme (copie en cours ?). Réessaie dans un instant. »**\
Un zip est encore en cours de copie ou ouvert dans un autre programme. Attends la fin de la copie.

**« Zip illisible ou incomplet (copie encore en cours ?). »** et les autres refus de zip\
Voir [Ce que doit contenir un zip](versions.md#ce-que-doit-contenir-un-zip).

**« Le zip dépasse 2 Go, la limite de GitHub. »**\
Retire du profil les fichiers lourds dont les joueurs n’ont pas besoin (shaders, packs de ressources, mondes…),
puis recrée la version.

**« pack.json est illisible (JSON invalide) : corrige-le ou supprime-le. »**\
Le fichier `pack.json` du modpack a été abîmé. Corrige-le, ou supprime-le : le Studio en recrée un, avec un
identifiant tiré du nom du dossier (vérifie qu’il est identique à l’ancien si le modpack est déjà publié).

**« Identifiant « … » invalide dans pack.json »** ou **« Identifiant « … » déjà utilisé par … »**\
L’identifiant doit être fait de lettres minuscules, de chiffres et de tirets, et être propre à un seul dossier.
Corrige le champ `id` de `pack.json`.

**« Plusieurs zips pour la v3 (…) : n’en garde qu’un. »**\
Deux fichiers portent le même numéro de version. Supprime ou renomme l’un d’eux.

**« Le dossier ne contient aucun modpack : publier supprimerait tout de GitHub. »**\
Le dossier choisi est vide (mauvais dossier, disque débranché ?). Vérifie **Paramètres → Dossier des modpacks**
avant de publier.

## Signalement

**« Le compte connecté n’a pas le droit de créer une issue sur ce dépôt (jeton limité à un autre dépôt ?). »**\
Le jeton connecté est limité à ton dépôt de modpacks. Clique sur **Ouvrir plutôt le signalement sur GitHub** : il
s’ouvre dans ton navigateur, déjà rempli.

## Toujours bloqué ?

[Signale le problème](signalement.md) en gardant les informations techniques jointes, et recopie le message exact
dans la description : c’est ce qui permet de le corriger le plus vite.
