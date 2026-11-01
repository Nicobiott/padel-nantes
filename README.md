# Padel Nantes

Affiche, sur les 30 prochains jours, les créneaux de padel libres des clubs de la région nantaise. L'app est pensée pour le téléphone et s'installe sur l'écran d'accueil.

## Mettre l'app en ligne (gratuit, sans serveur)
GitHub récupère les créneaux toutes les 30 minutes et publie la page sur GitHub Pages.

1. Crée un compte sur github.com, puis un nouveau dépôt (par exemple `padel-nantes`).
2. Envoie-y le contenu de ce dossier, y compris le dossier caché `.github`. Le plus simple : bouton « Add file › Upload files » sur la page du dépôt.
3. Dans le dépôt : **Settings › Pages › Source : GitHub Actions**.
4. Onglet **Actions** › « Mise à jour des créneaux » › **Run workflow**.
5. Au bout d'environ une minute, l'adresse de l'app s'affiche dans le résultat (du type `https://<ton-compte>.github.io/padel-nantes/`).
6. Sur l'iPhone, ouvre cette adresse dans Safari, puis **Partager › Sur l'écran d'accueil**.

GitHub peut décaler les mises à jour planifiées de quelques minutes. Si un dépôt reste 60 jours sans activité, GitHub suspend les tâches planifiées : il suffit de relancer « Run workflow ».

## Recevoir une alerte sur l'iPhone quand un créneau se libère
Toutes les 30 minutes, la tâche compare les créneaux à ceux de la fois précédente. Un créneau qui apparaît (une annulation, ou un nouveau jour ouvert à la réservation) et qui correspond à une de tes « veilles » déclenche une notification.

1. Installe l'app gratuite **ntfy** sur l'iPhone (App Store), sans créer de compte.
2. Dans ntfy, abonne-toi à un nom de canal difficile à deviner, par exemple `padel-nantes-` suivi de quelques lettres et chiffres au hasard. Ce nom fait office de mot de passe : toute personne qui le connaît peut lire tes alertes.
3. Sur GitHub, dans le dépôt : **Settings › Secrets and variables › Actions › New repository secret**. Nom : `NTFY_TOPIC`, valeur : le nom du canal.
4. Modifie `watches.json` (crayon ✏️ sur la page du fichier dans GitHub) pour décrire ce que tu cherches.

Format d'une veille :
```json
{ "name": "Mardi ou jeudi soir", "days": [2, 4], "from": "18:00", "to": "21:00", "duration": 90, "clubs": [] }
```
- `days` : 1 = lundi … 7 = dimanche (vide = tous les jours). On peut aussi viser des dates précises : `"dates": ["2026-11-14"]`.
- `withinDays` : ne prévient que pour les créneaux des N prochains jours (ex. 7). Évite d'être notifié chaque fois qu'un club ouvre un nouveau jour loin devant.
- `from` / `to` : ta plage de disponibilité. La partie doit commencer après `from` et se terminer avant `to`.
- `duration` : 60, 90 ou 120 minutes (absent = toutes).
- `clubs` : identifiants des clubs (voir `clubs.json`) ; vide = tous.

La première collecte sert de référence : les alertes commencent à la suivante.

## Partager avec des amis
L'app est une simple page web : il suffit d'envoyer son adresse (`https://<ton-compte>.github.io/padel-nantes/`). Sur iPhone, la page explique comment l'ajouter à l'écran d'accueil.

- **Aucun coût ni charge en plus** : la page lit les créneaux déjà récupérés par GitHub. Que vous soyez 1 ou 20, les clubs reçoivent le même nombre de requêtes.
- **Discrétion** : la page n'apparaît pas dans Google (balise `noindex`), mais toute personne qui a le lien peut l'ouvrir. Il n'y a pas de données personnelles dedans : seulement les créneaux libres des clubs.
- **Le dépôt GitHub est public** (GitHub Pages gratuit l'exige) : on peut y voir le code et `watches.json`. Les canaux ntfy, eux, restent secrets.

### Des alertes pour chaque ami
1. L'ami installe **ntfy** et s'abonne à son propre canal (nom difficile à deviner).
2. Il t'envoie ce nom ; tu l'ajoutes dans GitHub : **Settings › Secrets and variables › Actions › New repository secret**, nom `NTFY_TOPIC_PAUL` (en majuscules, sans espace ni accent), valeur = son canal.
3. Dans `watches.json`, ajoute ses veilles avec `"notify": "NTFY_TOPIC_PAUL"`. Une veille sans `notify` va sur ton canal (`NTFY_TOPIC`).

Pour des alertes communes à tout le groupe, il suffit que chacun s'abonne au même canal dans ntfy.

## Lancer sur un ordinateur
Il faut Node 18 ou plus récent. Aucune dépendance à installer.
```
node collect.js         # récupère les créneaux et affiche l'état de chaque club
node server.js          # lance l'app sur http://localhost:3000
MOCK=1 node server.js   # mode test avec des créneaux fictifs
```

## État des clubs
Seuls les clubs d'au moins 4 terrains sont affichés (`MIN_COURTS` dans `collect.js`), sauf ceux marqués `"always": true` dans `clubs.json`.

| Club | Terrains | Plateforme | État |
|---|---|---|---|
| Hangar 24 (Nantes) | 6 | Anybuddy | branché, vérifié le 01/11/2026 |
| Le Set (Le Bignon) | 5 | Anybuddy | branché, vérifié le 01/11/2026 |
| Urban Padel Carquefou | 11 | MyUrban (Urban Soccer) | pas branchable : compte obligatoire et anti-robot |
| Centre de Ligue (Vertou) | 4 | Ten'Up | pas branché : Ten'Up bloque les robots |
| La Pala (Les Ponts-de-Cé) | 8 | Gestion Sports (app La Pala) | pas branchable : app mobile avec compte |
| La Cancha (Cholet) | 4 | MyMobileApp | branché, vérifié le 01/11/2026 (planning public) |
| L'Autre Usine (Cholet) | ? | Apex Timing | branché (horaires libres, sans le nombre de terrains) |
| ESPARK 23 (Ancenis) | 2 | Apex Timing (sans le padel) | pas réservable en ligne |

Les clubs non branchés apparaissent dans l'app avec un lien direct vers leur page de réservation.

### Ajouter Smash Goal (ou un autre club Doinsport)
1. Ouvre la page de réservation padel du club dans un navigateur et choisis l'activité padel.
2. Copie l'adresse de la page, qui contient `guid=…` et `activitySelectedId=…`.
3. Lance `node doinsport-ids.js "<adresse>"` et colle le résultat dans `clubs.json`.

### Ajouter un club Anybuddy
Dans `clubs.json`, mets `"platform": "anybuddy"` et, dans `platformId`, le nom du club tel qu'il apparaît dans son adresse Anybuddy (`anybuddyapp.com/fr/club/<nom>`).

## Limites
Ces plateformes n'ont pas d'accès officiel pour leurs données : l'app utilise les mêmes appels publics que leurs sites, sans compte, et seulement quelques fois par heure. Un changement chez une plateforme peut casser son module ; `node collect.js` permet de le repérer, et la tâche GitHub échoue (avec un e-mail) si plus aucun club ne répond.

Méthodes reprises de deux projets publics : github.com/Paddadie/ResaPadel (Doinsport, Sporting Nantes) et github.com/RolandVrignon/paris-padel-anybotty (Anybuddy et Playtomic, licence MIT).

## Structure
- `clubs.json` : les clubs, leur plateforme (`platform`) et leur identifiant sur celle-ci (`platformId`).
- `adapters/` : un module par plateforme, qui renvoie les créneaux dans un format commun.
- `collect.js` : récupère tous les clubs sur 30 jours, écrit `public/data.json` et envoie les alertes.
- `alerts.js` et `watches.json` : détection des nouveaux créneaux et veilles.
- `test/` : tests automatiques (`node --test`), lancés à chaque mise à jour.
- `server.js` : version locale, qui sert la page et des données fraîches.
- `public/` : la page (`index.html`), les icônes et le manifeste pour l'écran d'accueil.
- `.github/workflows/update.yml` : la mise à jour automatique et la publication.
