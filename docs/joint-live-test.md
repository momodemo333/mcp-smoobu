# Test réel conjoint (pas exécuté)

Aucune modification distante ni mise en production n'est autorisée par les tests locaux. dist et configuration d'exploitation restent inchangés.

1. Relire les ruptures de compatibilité et la revue indépendante. Choisir ensemble le binaire staging et conserver le binaire/configuration production, sans les remplacer maintenant.
2. Démarrer en lecture seule avec les secrets existants injectés de manière sûre. get_capabilities, get_user, logements, une page messages/threads, tarifs sur 2–3 dates, disponibilité. Ne pas journaliser clés, contacts, messages privés ou URLs à jetons.
3. Pour tester tarifs: Morgan choisit **un seul logement, une seule date future libre et une valeur explicite**, sans réservation confirmée concernée. Vérifier prix/minimum existants, devise, paramètres/majorations canaux, synchronisation activée, éventuel moteur concurrent. Conserver snapshot horodaté privé.
4. Appeler preview_rates et relire logement/date/montant/minimum/portée. Aucun disponible=0/1. Le preview ne lit pas l'état et ne vaut pas autorisation.
5. Accord explicite de Morgan sur ce changement réel précis. Activer seulement catégorie rates dans un processus de test contrôlé, global writes=true. Aucun autre outil d'écriture nécessaire.
6. Relire le snapshot immédiatement avant application; si modifié, arrêter/replanifier. Envoyer UNE requête. Si timeout/erreur/JSON invalide: **ne pas rejouer**; relire Smoobu, vérifier manuellement la plateforme si pertinent, demander support si état indéterminé.
7. Relire prix/minimum puis contrôler propagation canal (délai possible, montant client pas nécessairement égal au tarif brut). HTTP200 seul ne prouve pas propagation.
8. Restauration uniquement si autorisée et état courant exactement égal à l'état appliqué; sinon arrêter pour ne pas écraser une modification tierce. Un ancien prix null n'a pas de restauration documentée sûre: choisir une date avec prix existant pour ce premier test.
9. Désactiver écritures et consigner résultat, IDs/dates/prix et incertitudes sans secrets. Ne pas supprimer/annuler une réservation pour « nettoyer » un essai.

Messages: seulement un vrai message utile validé (destinataire, réservation, fil, texte final), jamais un message factice, pas de restauration possible. Réservations, annulations, price-elements: validation séparée, pas d'essai opportuniste. Webhooks: lecture seule, aucun récepteur existant modifié.
