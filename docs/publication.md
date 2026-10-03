# Publier et supprimer

Publier met les releases GitHub en accord avec ton dossier des modpacks : nouvelles versions, mises à jour et
suppressions, en une seule opération que tu valides après en avoir vu le détail.

## Publier sur GitHub

1. Clique sur **Publier sur GitHub** (ou **Voir et publier** dans l’encart des changements). Le Studio relit GitHub
   pour partir d’un état tout frais : « Comparaison du dossier avec GitHub… ».
2. L’aperçu liste les changements, regroupés en **Nouvelles versions**, **Mises à jour** et **Suppressions**, avec le
   détail de chacun et la quantité de données à envoyer.
3. Lis les avertissements, puis clique sur **Publier N changements**. Le bouton est rouge quand l’opération supprime
   des releases.
4. Chaque étape s’affiche avec sa progression : envoi de chaque fichier, débit, étape en cours. Garde le Studio
   ouvert jusqu’à la fin.
5. « GitHub correspond maintenant à ton dossier. » : la Bibliothèque est rechargée aussitôt pour te montrer le
   résultat, et tes joueurs le verront à leur prochaine actualisation.

**Arrêter** interrompt la publication proprement : l’étape en cours est annulée sans laisser de release incomplète,
et ce qui a déjà été fait est conservé. Relance **Publier** pour terminer.

Si ton dossier ou GitHub a changé entre l’aperçu et ton clic, rien n’est fait : « Le dossier ou GitHub a changé
depuis l’aperçu : vérifie la nouvelle liste puis relance. »

L’aperçu peut afficher ces avertissements :

- des zips ne sont **pas encore rangés** : ils seront ignorés. Ferme l’aperçu et range-les d’abord ;
- un modpack **en erreur** est ignoré tant que ses erreurs ne sont pas corrigées ;
- un modpack **n’aura plus aucune version** : il disparaîtra de l’application des joueurs ;
- le dossier **ne contient aucun modpack** alors que GitHub en a : publier supprimerait tout. Vérifie que le dossier
  choisi est le bon.

## Ce que contient une release

Pour chaque version, le Studio crée une release GitHub :

| Élément | Valeur |
|---|---|
| Tag | `pack-<id>-v<N>`, par exemple `pack-hardcore-endgame-v3` |
| Titre | `<Nom> v<N>`, par exemple « Hardcore Endgame v3 » |
| Texte | Les notes de la version, suivies de la version de Minecraft, du mod loader et du nombre de mods |
| Fichiers | `<id>-<N>.zip` (le contenu de l’instance), `modpack.json` (sa description) et, s’il y en a une, `cover.png` (ou `.jpg`, `.webp`) |

La release n’est jamais marquée « Latest » sur GitHub : cette place revient à l’installeur de l’application. Le
détail de `modpack.json` est dans [Fichiers et dossiers](fichiers.md#format-dune-release-de-modpack).

Une release n’est jamais visible à moitié : elle est créée en brouillon, ses fichiers sont envoyés, puis elle est
publiée d’un coup. Un fichier remplacé est d’abord envoyé sous un autre nom, puis échangé avec l’ancien. Un envoi
interrompu par le réseau est retenté, jusqu’à trois tentatives. Un brouillon laissé par une publication interrompue
est signalé (« Brouillon abandonné sur GitHub ») et supprimé à la publication suivante.

## Ce qui met à jour une release

Une version déjà publiée est mise à jour quand :

| Changement | Ce qui est envoyé |
|---|---|
| Le contenu du zip a changé | Le zip, puis `modpack.json` |
| Le zip manque ou est incomplet sur GitHub | Le zip, puis `modpack.json` |
| L’image a changé | L’image, puis `modpack.json` |
| Le nom ou la description a changé | `modpack.json` et le titre de la release |
| Les notes ont changé | Le texte de la release |
| Des fichiers en trop sont sur la release | Ils sont retirés |

Les versions publiées avant que l’application sache reconnaître un modpack à ses mods reçoivent aussi leur
« empreinte des mods » : seul leur `modpack.json` est renvoyé.

> [!WARNING]
> Remplacer le contenu d’un zip déjà publié met bien la release à jour, mais les joueurs qui ont déjà cette version
> **ne sont pas prévenus** : pour eux, rien n’a changé. Pour une mise à jour, dépose plutôt un nouveau zip : il
> deviendra une nouvelle version, proposée à tous.

## Supprimer une version ou un modpack

Le dossier fait foi : supprimer un zip dans l’Explorateur, puis publier, supprime sa release. Le Studio permet aussi
de supprimer tout de suite, après une confirmation qui dit exactement ce qui va se passer :

- **la corbeille au bout d’une version** : son zip part à la corbeille de Windows et sa release est retirée de
  GitHub, avec son tag. La fenêtre de confirmation indique quelle version redevient la dernière proposée aux
  joueurs, ou si le modpack disparaît de leur application ;
- **Supprimer**, sur la carte d’un modpack : son dossier part à la corbeille (zips, image, notes) et toutes ses
  releases sont retirées ;
- **Retirer maintenant**, sur un modpack dont le dossier n’existe plus, ou **la corbeille** d’une version
  « Sera retirée » : ses releases sont retirées sans rien toucher sur ton PC.

Ce sont exactement les suppressions qu’une publication ferait. Elles demandent le rôle de publieur et un compte
GitHub connecté qui peut publier sur le dépôt : GitHub est vérifié avant de toucher au dossier. Si GitHub refuse la
suppression après coup, le dossier est déjà à jour : la release sera retirée à la publication suivante.

À savoir :

- **Les joueurs gardent ce qu’ils ont installé** : une version supprimée disparaît de leur liste, pas de leur
  CurseForge.
- **Un numéro n’est jamais réutilisé** : après la suppression de la v3, la prochaine version sera la v4.
- **Un zip restauré** depuis la corbeille de Windows est republié à la publication suivante, sous son numéro.

> [!CAUTION]
> Une suppression sur GitHub est définitive : la release et son tag disparaissent. Seul le zip, sur ton PC, peut
> être récupéré dans la corbeille.

## Une opération à la fois

Le rangement, la publication, une suppression, la création d’un zip et la copie de fichiers ne se font jamais en
même temps : une opération lancée pendant une autre est refusée (« Patiente : la publication est en cours. »). Elles
attendent aussi la fin d’une mise à jour de l’application, qui attend à son tour la leur.

Fermer la fenêtre pendant une publication l’interrompt : les étapes terminées restent faites, la suite sera reprise
à la publication suivante.

## Bonnes pratiques

- **Une mise à jour = un nouveau zip.** Ne remplace jamais le contenu d’une version publiée.
- **Vérifie le contenu** avec le bouton **Contenu** avant de publier : pas de monde, de journaux ni de fichier
  personnel par erreur.
- **Écris les notes** avant de publier : c’est ce que les joueurs lisent en premier.
- **Teste chez un joueur** : après la publication, installe la nouvelle version depuis la Bibliothèque, comme le
  ferait un joueur.
- **Garde le dépôt public**, sinon tes joueurs ne voient plus rien.
