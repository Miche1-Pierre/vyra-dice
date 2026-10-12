# Envoi des demandes : e-mail et WhatsApp

> Linear : VYR-68 (plan et décisions), VYR-71 (comptes et secrets), VYR-72 (envoi au manager), VYR-73 (accusé à
> l'acheteur).

Quand un acheteur envoie le formulaire, la Server Action `submitBookingRequest`
(`src/app/[club]/[event]/actions.ts`) envoie elle-même, sans outil tiers d'automatisation :

1. **au manager**, en même temps :
   - un **e-mail** (Resend) mis en page pour le téléphone : client, table, soirée, chiffres affichés au moment de la
     demande, et de quoi répondre en un appui (bouton WhatsApp vers le client, appel, « Répondre » qui écrit au
     client) ;
   - un **message WhatsApp** (API Cloud de Meta) : un modèle validé par Meta, dont les variables sont remplies ;
2. **à l'acheteur**, après la réponse (`after()`), un **e-mail récapitulatif** aux couleurs du club : merci, la
   demande telle qu'envoyée, « ce n'est pas encore une réservation », les canaux du club. « Répondre » écrit au
   manager.

Le code est dans `src/server/notify/` : `config.ts` (variables d'environnement), `messages.ts` (contenu des messages),
`resend.ts` et `whatsapp.ts` (appels aux deux services), `notify.ts` (qui reçoit quoi).

## Règles

- **La demande est transmise** quand un canal au moins a atteint le manager. Sinon : échec honnête pour l'acheteur,
  saisie conservée, contact de secours ; la demande est oubliée pour que son nouvel essai parte vraiment.
- **Pas de doublon** : une demande renvoyée (double appui, réseau) n'est envoyée qu'une fois. La clé du formulaire
  sert aussi de clé d'idempotence chez Resend (24 h).
- **Club de démo** (`club.demo`, tant qu'il n'y a pas d'accord écrit, VYR-15) : tout part vers l'équipe
  (`REQUESTS_TEAM_*`), jamais vers le club ; « [Démo] » dans l'objet ; le récapitulatif vient de « VYRA (démo) » et
  dit en tête que la demande n'a pas été transmise au club. Un club réel écrit « <club> via VYRA » : jamais au nom
  d'un club sans son accord.
- **Club réel** : pas encore branché (VYR-19). Les coordonnées de son manager resteront hors du dépôt (variables, puis
  base VYR-17).
- **Sans canal configuré**, une démo accuse réception sans rien envoyer, et l'écran le dit.
- **Anti-abus** : champ piège invisible (`leaveBlank`) ; 5 demandes par 10 min par adresse IP ; un récapitulatif par
  adresse e-mail toutes les 10 min ; le récapitulatif ne reprend aucun texte libre de l'expéditeur (seulement les
  lettres de son prénom), car il part à n'importe quelle adresse saisie.
- **Données personnelles** : jamais dans les logs (canal, statut, code d'erreur et référence seulement). Resend et Meta
  sont sous-traitants, cités sous le formulaire.
- **Wording** : une demande n'est jamais présentée comme une réservation confirmée.

## Variables d'environnement

Dans `.env.local` en local, et dans Vercel (Production et Preview). Liste et commentaires : `.env.example`. Un canal
sans tous ses réglages reste éteint.

| Variable                     | Rôle                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `RESEND_API_KEY`             | Clé d'API Resend, droit « Sending access »                                        |
| `REQUESTS_FROM_EMAIL`        | Adresse d'envoi sur le domaine vérifié (`demandes@notifications.<domaine>`)       |
| `REQUESTS_TEAM_EMAIL`        | Qui reçoit les demandes des démos (adresses séparées par des virgules)            |
| `WHATSAPP_TOKEN`             | Jeton d'un utilisateur système Meta (permanent)                                   |
| `WHATSAPP_PHONE_NUMBER_ID`   | Identifiant du numéro d'envoi (« Phone number ID », pas le numéro lui-même)       |
| `REQUESTS_TEAM_WHATSAPP`     | Numéros de l'équipe, avec l'indicatif (`+33 6 12 34 56 78`), séparés par virgules |
| `WHATSAPP_TEMPLATE`          | Facultatif : nom du modèle (`nouvelle_demande_table`)                             |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Facultatif : langue du modèle (`fr`)                                              |
| `WHATSAPP_API_VERSION`       | Facultatif : version de l'API Graph (`v23.0`)                                     |

## Mettre en place Resend

1. Créer le compte (au nom de l'équipe), puis une clé d'API « Sending access » : `RESEND_API_KEY`.
2. **Premier essai sans domaine** : `REQUESTS_FROM_EMAIL=onboarding@resend.dev` envoie, mais seulement à l'adresse du
   compte Resend. Mettre cette adresse dans `REQUESTS_TEAM_EMAIL`, et la saisir comme e-mail de l'acheteur pour
   recevoir aussi le récapitulatif.
3. **Domaine** : Resend → Domains → Add domain, un sous-domaine dédié (`notifications.<domaine>`), région Irlande
   (`eu-west-1`) si l'offre le permet. Poser chez l'hébergeur du domaine les enregistrements affichés (DKIM, SPF, MX
   de retour), plus un DMARC en `p=none` pour commencer. Une fois « Verified » :
   `REQUESTS_FROM_EMAIL=demandes@notifications.<domaine>`.
4. Vérifier dans Gmail (« Afficher l'original ») : SPF, DKIM et DMARC à « PASS ».

Offre gratuite : 3 000 e-mails par mois, 100 par jour. Les données du compte restent aux États-Unis (la région ne
change que le point d'envoi).

## Mettre en place WhatsApp (API Cloud de Meta)

1. [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Créer une app** : un nom (« VYRA
   demandes »), l'e-mail de contact, puis le cas d'usage **« Communiquer avec les clients via WhatsApp »** (_Connect
   with customers through WhatsApp_). Choisir ou créer le **portefeuille business** de l'équipe, puis **Créer
   l'app**.
2. Dans l'app : **WhatsApp → Configuration de l'API** (_API Setup_), **Démarrer avec l'API**. Meta crée un compte
   WhatsApp Business de test et un **numéro de test** gratuit. Noter le **Phone number ID** :
   `WHATSAPP_PHONE_NUMBER_ID`.
3. Champ **À** (_To_) → **Gérer la liste des numéros** : ajouter les numéros de l'équipe (5 au plus), chacun confirmé
   par un code reçu sur WhatsApp. Ce sont `REQUESTS_TEAM_WHATSAPP`.
4. **Générer un jeton d'accès** puis **Envoyer le message** : le modèle `hello_world` arrive sur le téléphone. Ce jeton
   expire en 24 h : il suffit pour un premier essai (`WHATSAPP_TOKEN`).
5. **Le modèle** : [WhatsApp Manager](https://business.facebook.com/latest/whatsapp_manager/message_templates) →
   **Créer un modèle** → catégorie **Utilitaire**, nom `nouvelle_demande_table`, langue **Français**, variables de type
   **Nombre**, corps ci-dessous (avec des valeurs d'exemple), sans en-tête ni bouton. Envoyer en validation : un modèle
   utilitaire est en général validé en quelques minutes.
6. **Jeton permanent** : [Paramètres business](https://business.facebook.com/settings) → **Utilisateurs système** →
   **Ajouter** (rôle Admin) → **Assigner des éléments** : l'app (contrôle total) et le compte WhatsApp (contrôle total)
   → **Générer un jeton** pour l'app, expiration **Jamais**, permissions `whatsapp_business_messaging` et
   `whatsapp_business_management`. Il remplace le jeton de 24 h dans `WHATSAPP_TOKEN`.

Corps du modèle `nouvelle_demande_table` (les variables ne peuvent contenir ni retour à la ligne ni tabulation :
`messages.ts` les met sur une ligne) :

```
Nouvelle demande de table {{1}} pour la soirée {{2}}.

Table : {{3}}
Client : {{4}}
Contact : {{5}}
Message : {{6}}

Ce n'est pas une réservation : confirmez ou refusez directement avec le client.
```

| Variable | Contenu                                                      | Exemple                                                    |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `{{1}}`  | Référence, « (démo) » pour un club de démo                   | `SCL-7K2QX (démo)`                                         |
| `{{2}}`  | Soirée, date et club                                         | `Rudboy du samedi 10 octobre au 809 Social Club`           |
| `{{3}}`  | Table, zone, personnes, arrivée, chiffres affichés           | `B4 (Carré 809) · 6 pers. · arrivée 00h30 · minimum 900 €` |
| `{{4}}`  | Prénom et nom                                                | `Camille Martin`                                           |
| `{{5}}`  | Téléphone (international, touchable dans WhatsApp) et e-mail | `+33 6 12 34 56 78 · camille@exemple.fr`                   |
| `{{6}}`  | Message, ou « aucun »                                        | `Anniversaire, deux bouteilles`                            |

Le numéro de test n'écrit qu'aux numéros autorisés : parfait pour la démo. Pour un vrai club : un numéro dédié à
VYRA (pas déjà utilisé sur WhatsApp), un nom affiché validé par Meta, et la vérification de l'entreprise si le volume
l'exige. Coût : environ 0,03 $ par message utilitaire en France (à vérifier sur la grille de Meta), gratuit dans les
24 h qui suivent un message du destinataire.

## Vérifier

- `pnpm test` couvre la mise en forme, les échecs, les doublons et les logs sans données personnelles.
- En local, avec `.env.local` rempli : envoyer une demande depuis une démo (`pnpm dev`), puis vérifier l'e-mail, le
  WhatsApp et le récapitulatif.
- Les erreurs d'envoi apparaissent dans les logs du serveur (`[notify] …`) : code HTTP et code d'erreur du service.
