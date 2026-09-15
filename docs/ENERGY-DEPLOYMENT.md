# Déploiement du MVP énergie

Le MVP adapte l'application Next.js de Career-Ops. Son cœur Node collecte les offres auprès des portails employeurs SmartRecruiters configurés dans `examples/energy/portals.yml`. Les descriptions sont analysées après filtrage géographique. La couverture actuelle est limitée à Veolia, Vattenfall, Accor et Tenergie ; elle ne représente pas tout le marché.

## Production

Image : `Dockerfile.energy`. Démarrage : `node deploy/start-energy.mjs`. Railway : configuration fournie dans `railway.json`.

- Monter un volume persistant sur `/app/user`, accessible à l'utilisateur Node (UID 1000).
- Définir `CAREER_OPS_WEB_PASSWORD` avec un mot de passe fort et activer le domaine HTTPS de l'hébergeur.
- Identifiant de connexion : `career-ops`. Aucun mot de passe n'est stocké dans le dépôt.
- Le port est fourni par `PORT`. La collecte démarre au lancement puis est vérifiée chaque heure ; les résultats réussis sont réutilisés pendant 12 heures.
- Le volume conserve profil, sources, descriptions, résultats et statuts dans `data/opportunities.md`. Sauvegarder le volume régulièrement. L'initialisation ne remplace jamais les fichiers existants.
- Pour un lancement Docker local : `docker compose -f deploy/compose.energy.yml up --build -d`, après définition du mot de passe. Le port local est limité à 127.0.0.1.

L'image exclut les données personnelles locales. Le profil fourni contient seulement les critères demandés. L'accès public échoue si le mot de passe manque. Les anciens écrans Career-Ops restent disponibles et protégés par le même accès.

## Analyse et limites

Le barème 30/25/20/15/10 est indépendant du scoring historique Career-Ops sur 5. Les règles contextuelles constituent le mode actif. L'analyse IA optionnelle nécessite `opportunities.aiEnabled: true`, `OPENAI_API_KEY` et `OPENAI_MODEL` ; elle exige des preuves présentes dans la description et ne peut lever les exclusions géographiques. Elle n'a pas été testée avec un compte réel.

Les descriptions sont limitées à 100 offres géographiquement admissibles par source et par collecte. L'interface indique les descriptions manquantes et les erreurs. Une absence dans un flux ne prouve pas une expiration : l'offre passe en disponibilité non confirmée. Les résultats périmés ne sont plus recommandés. Une date absente reste inconnue.

Le score mesure l'adéquation aux critères métier, pas l'adéquation à un CV qui n'a pas été fourni. Aucun envoi de candidature automatique.

## Vérification

- Cœur : `node tests/opportunities.test.mjs` et `node tests/providers/smartrecruiters.test.mjs`.
- Interface et régressions : `cd web && npm test`.
- Production : `cd web && npm run build`.

Le runtime de vérification ne fournit pas `/proc` : le build y nécessite un contournement local de la mesure mémoire et TypeScript 5.9.3 à la place du compilateur natif TypeScript 7. Ces substitutions ne font pas partie de l'image. Une construction sur l'hébergeur demeure une étape obligatoire avant de déclarer la mise en production réussie.
