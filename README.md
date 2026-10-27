# El Resto

**Commander en ligne et faire tourner la salle, depuis le même site.**

El Resto est un site de commande en ligne doublé d'un outil de gestion, conçu pour un restaurant tunisien.
Les clients commandent sur place, à emporter ou en livraison, et paient à la réception.
Le site est pensé pour la carte réelle du restaurant : pizzas, plats, sandwichs, makloub, baguettes farcies,
tabouna, cornets, lablabi et boissons.

## Ce que l'application permet

### Pour les clients

- Parcourir la carte par catégories et voir d'un coup d'œil les plats populaires ou épuisés.
- Retrouver un plat en tapant son nom dans la recherche.
- Mettre ses plats préférés en favoris pour les retrouver en un clic.
- Composer son panier et voir le total avant de valider.
- Commander sur place en scannant le QR code de sa table, sans attendre le serveur.
- Commander à emporter ou en livraison, avec les frais et le minimum de livraison affichés.
- Enregistrer ses adresses de livraison et choisir l'adresse par défaut.
- Suivre l'avancement de sa commande, mis à jour automatiquement.
- Annuler sa commande tant que la cuisine ne l'a pas prise en charge.
- Retrouver l'historique de ses commandes et recommander la même chose en un clic.
- Gérer son profil et changer son mot de passe.

### Pour le restaurant

- Voir les nouvelles commandes arriver en direct, avec une alerte sonore.
- Faire avancer chaque commande : en attente, en préparation, prête, terminée (ou annulée).
- Repérer les commandes en retard, signalées en rouge.
- Gérer la carte : catégories, articles, prix, photos, disponibilité et ordre d'affichage.
- Régler les horaires d'ouverture et ouvrir ou fermer la prise de commandes d'un clic.
- Gérer les tables et imprimer leurs QR codes.
- Suivre la salle : tables libres, occupées ou à encaisser, encaisser et libérer une table.
- Consulter un tableau de bord des ventes : chiffre d'affaires, panier moyen, plats les plus vendus, heures de pointe.
- Gérer les comptes clients : rechercher, activer ou désactiver un compte.

## Comment ça se passe

1. Le client s'installe, scanne le QR code posé sur sa table et arrive sur la carte.
2. Il choisit ses plats, vérifie son panier et valide sa commande (il se connecte à son compte s'il ne l'est pas déjà).
3. En cuisine, l'écran des commandes sonne : l'équipe passe la commande « en préparation », puis « prête ».
4. Le client voit l'avancement sur son téléphone.
5. Le serveur encaisse la table depuis le plan de salle, puis la libère pour les clients suivants.


## Technologies

| Partie | Outils |
| --- | --- |
| Site | React, TypeScript, Tailwind CSS |
| API | ASP.NET Core 8, PostgreSQL |
| Hébergement | prévu sur Render et Neon |

## Points forts du projet

- **Des montants fiables** : sous-total, frais et total sont recalculés par le serveur à partir des prix enregistrés ; le navigateur n'envoie jamais de prix.
- **Pas de commande en double** : un double clic ou deux envois simultanés ne créent qu'une seule commande.
- **Un QR code par table** : généré directement dans le navigateur, imprimable, et remplaçable si un QR doit être invalidé.
- **Un tableau de bord juste et accessible** : les ventes sont comptées à l'heure de Tunis (une commande tardive tombe dans le bon jour) ; chaque graphique a un résumé et un tableau équivalent pour les lecteurs d'écran, se parcourt au clavier, et les variations ne reposent jamais sur la couleur seule.
- **Comptes et rôles** : client ou administrateur ; un compte désactivé perd l'accès immédiatement, et la connexion est bloquée 10 minutes après 5 mots de passe erronés.
- **Testé automatiquement** : 517 tests côté serveur, tous réussis ; 431 tests côté site, tous réussis.
## Essayer le projet

Prérequis : .NET 8, Node.js et une base PostgreSQL (chaîne de connexion et mot de passe administrateur à régler d'abord).

```powershell
cd backend/src/Resto.Api; dotnet ef database update          # crée les tables
cd backend/src/Resto.Api; dotnet run -- --seed-catalog --apply # charge la carte
cd backend/src/Resto.Api; dotnet run                           # API sur http://localhost:5118
cd frontend; npm install; npm run dev                          # site sur http://localhost:5173
```

## Crédits

- Photos des plats : Unsplash (licence Unsplash), sauf une photo fournie par le propriétaire du projet dont la source reste à confirmer ; auteurs et sources dans [docs/images-credits.md](docs/images-credits.md).
- Polices : Fraunces et Inter, auto-hébergées via Fontsource.


