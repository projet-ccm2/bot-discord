# DB — Table channel : champ Discord webhook

## Objectif

Permettre à bot-discord d’envoyer des notifications vers un canal Discord par channel métier : une **chaîne Twitch** = un **channel** en base = un **serveur/canal Discord** choisi par l’utilisateur (une seule URL de webhook par channel).

## Modification côté base de données

- **Table (ou ressource)** : `channel`
- **Nouveau champ** : `discord_webhook_url` (ou `discordWebhookUrl` si la gateway expose du camelCase)
- **Type** : string (URL), nullable
- **Sémantique** : URL complète du webhook Discord pour le canal où envoyer les notifications pour ce channel (chaîne Twitch). Une seule URL par channel = un seul canal Discord cible.

## Modification côté DB-gateway

- **GET /channels/:id** : inclure dans la réponse le champ `discordWebhookUrl` (ou `discord_webhook_url` selon convention API).
- **POST /channels** et **PUT /channels/:id** : accepter en body ce même champ pour création et mise à jour (optionnel).

Référence : [DB-gateway doc channels](https://github.com/projet-ccm2/DB-gateway/tree/main/doc).

## Sécurité

L’URL du webhook est **sensible** : quiconque la possède peut poster dans le canal Discord. Ne pas la logger en clair, ne l’exposer qu’aux services autorisés.

## Résumé

- Un **channel** = une entité métier (ex. chaîne Twitch).
- Le lien vers Discord = une seule URL de webhook stockée sur le channel, utilisée par bot-discord pour envoyer l’embed via `POST /notify`.
