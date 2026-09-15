# Journal du MVP énergie

## Analyse avant implémentation

Base : Career-Ops 1.32.0, branche dédiée issue du dépôt demandé.

- Le cœur Node ESM orchestre des providers publics, sans LLM pour la collecte. `providers/_registry.mjs` route les sources ; `_http.mjs` fournit les délais et protections réseau. Le type `Job` contient titre, entreprise, URL, localisation, description et parfois date/salaire.
- `web/` est l'application Next.js existante : Explore, Pipeline, rapports, configuration. Ses routes orchestrent les scripts du cœur. `dashboard/` est une interface terminal Go, pas l'interface web.
- Le scoring existant est une appréciation IA holistique sur 5 (modes/_shared.md, modes/oferta.md), non une somme pondérée. Le nouveau score de ciblage sur 100 restera distinct, sans altérer les évaluations historiques.
- Les fichiers utilisateur sont canoniques ; SQLite est un index dérivé. `path-resolver.mjs`, `pipeline-lock.mjs`, `url-key.mjs`, les providers et les utilitaires texte sont réutilisables.
- Les préférences appartiennent à config/profile.yml et modes/_profile.md. Aucun CV, salaire, diplôme ou expérience ne sera inventé.
- Dockerfile existant : environnement interactif Playwright/Go/LaTeX, sources montées et commande bash ; ce n'est pas une image de production web. Une variante web avec volume persistant et accès protégé est nécessaire.
- Tests : test-all.mjs au cœur ; node:test dans web/tests ; typecheck et build Next. Tests existants lancés avant les changements.

## Décisions

Adapter la page d'accueil existante via une option du profil. Ajouter au cœur un service de recommandations : collecte via providers, filtre géographique sur référentiel officiel, analyse contextuelle, barème configuré, déduplication conservatrice, état et conservation sur fichier Markdown. L'interface appelle ce service, sans recréer sa logique métier.

Enrichir le provider SmartRecruiters existant pour conserver date, identifiant, contrat et télétravail, et récupérer les descriptions après présélection géographique. Éviter la limite actuelle qui enrichit simplement les premières annonces mondiales.

Le MVP commence par des portails employeurs publics configurés ; couverture et erreurs visibles. Pas de fausses annonces en production. L'IA est optionnelle, structurée et mise en cache ; ses résultats ne peuvent annuler les exclusions déterministes. Un manque de preuve employeur/localisation reste un signal à vérifier.

## Implémentation et essais

Le cœur conserve les providers, les protections HTTP, la normalisation des URL, le verrouillage et les chemins utilisateur existants. Le nouveau service fournit collecte, référentiel des 123 communes de la zone, exclusions contextuelles, score pondéré, preuves, déduplication et statuts. La page d'accueil Next.js est adaptée derrière une option du profil ; les écrans historiques sont conservés.

Les essais réels ont récupéré 1 272 annonces sur les quatre portails configurés : Veolia 1 174 (123 dans la zone, 100 descriptions), Accor 96 (90 dans la zone, 90 descriptions), Tenergie 2 et Vattenfall 0. Le lot ne contient actuellement aucune recommandation satisfaisant toutes les règles. Des faux positifs de technicien assainissement et de gestion immobilière citant l'énergie uniquement comme expérience souhaitée ont été exclus et couverts par des tests.

Vérifications du MVP : 52 contrôles métier, 33 contrôles du provider SmartRecruiters, test du composant réel dans un DOM simulé (tri, filtre, détail, statut, erreur), contrôles d'accès privés et 7 vérifications HTTP sur Next.js démarré avec des données isolées. Build Next.js réussi avec les adaptations locales décrites dans ENERGY-DEPLOYMENT.md. Le navigateur distant ne peut pas atteindre le serveur local : aucune validation visuelle dans ce navigateur n'est revendiquée.

La suite historique initiale comptait 8 715 succès et 9 échecs. Plusieurs venaient du répertoire temporaire indisponible ; la relance utilise un répertoire autorisé. Les échecs réseau résiduels de la suite historique doivent rester visibles, sans affaiblir leurs assertions.

Déploiement préparé : image Docker dédiée, exclusion des données locales, volume persistant, démarrage et collecte périodique, contrôle d'accès. Le compte GitHub connecté n'a que l'accès en lecture au dépôt amont. Aucun changement n'a été poussé sur celui-ci. Aucune instance publique n'a été déployée : la connexion Railway nécessaire n'est pas disponible dans cette session. Docker n'est pas disponible localement, donc la construction effective de l'image sur l'hébergeur reste à vérifier.

Suite web finale : 573 tests recensés, 572 réussis, aucun échec et un ignoré. Le test DOM porte sur le composant réel compilé, pas une réimplémentation de sa logique.

La relance de la suite historique avec TMPDIR corrigé a encore rencontré l'expiration du contrôle de mise à jour distant et le test réseau d'archive-posting. Elle a ensuite cessé de produire des résultats pendant plus de trois minutes et a été interrompue ; aucun bilan complet « vert » n'est revendiqué pour cette relance. Le bilan initial complet reste 8 715 réussis / 9 échecs. Ces points et le build Docker sur l'hébergeur restent des réserves de mise en production.

Validation de `examples/energy/portals.yml` par le validateur existant : aucune erreur, aucun avertissement. Les données de test HTTP sont isolées et supprimées après les vérifications.

## Connexion Railway confirmée

Le projet Railway privé `career-ops-energie` a été créé, avec son environnement production. Aucun service ni déploiement n'a été lancé. Les outils connectés permettent le déploiement depuis GitHub ou une image Docker, mais ne proposent pas l'envoi du répertoire local. Le dépôt amont est en lecture seule et aucune copie `career-ops` n'a été trouvée dans le compte GitHub connecté. La connexion GitHub disponible ne propose pas de création de dépôt ni de fork. Une copie appartenant à l'utilisateur est donc nécessaire pour transférer la branche testée et poursuivre. Les identifiants du projet Railway sont conservés dans les données locales pour reprendre sans recréer le projet.
