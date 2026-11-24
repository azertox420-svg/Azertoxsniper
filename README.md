# Azertox Code Redeemer

Script Roblox pour **Steal a Brainrot** : lecture des annonces, assemblage des codes, redeem via les remotes du jeu, retype des codes rejetés, interface, guide intégré et solveur de riddles local avec fallback IA optionnel.

## Dépôt GitHub

```text
azertox_github/
├── README.md
├── manifest.json
├── code/
│   └── azertoxbest.lua
├── data/
│   ├── manifest.json
│   └── azertox_db.lua
└── tools/
    ├── build_single_riddle_db.js
    └── repair_azertox_db.js
```

Le script à exécuter est `code/azertoxbest.lua`. La base publiée est une table Lua plate de 24 146 questions canoniques, avec une réponse normalisée par question. Le script garde aussi sa base de connaissances intégrée pour les faits structurés, la validation et le contexte envoyé au fournisseur IA.

## Installation

1. Crée un dépôt GitHub avec cette arborescence.
2. Le script pointe déjà vers `azertox420-svg/Azertoxsniper`.
3. Charge `code/azertoxbest.lua` depuis ton exécuteur.
4. Entre ta clé Gemini ou Groq dans l’interface si tu veux le fallback IA. Aucune clé n’est incluse dans le dépôt.

Le code reader, les remotes de redeem (`MerchShop.RedeemCode`, `ModdedStockService.Redeem`, `StockEventService.Redeem`), le popup de résultat et le retype restent dans le script principal. La DB distante n’est utilisée que pour compléter le store local ; une panne réseau laisse le cache local fonctionnel.

## DB et régénération

La source de publication attend des fichiers JSONL dans `data/` du dépôt de travail. Pour reconstruire la table canonique :

```powershell
node tools/build_single_riddle_db.js <dossier-des-shards-source>
node tools/repair_azertox_db.js <dossier-des-shards-source>
```

Le dossier source doit contenir les fichiers `shard-001.json`, `shard-002.json`, etc. Sans argument, l’outil refuse de remplacer la DB publiée par une base vide.

Le générateur normalise les questions, déduplique les formulations, écarte les entrées génériques ou sensibles et choisit une réponse déterministe en cas de doublon. Il ne doit jamais recevoir de clé API, cookie, webhook ou token.

## Contrat de données

`data/manifest.json` décrit le fichier actif et son nombre d’entrées. Chaque entrée respecte :

```lua
{ q = "question normalisée", a = { "REPONSE" }, al = {} }
```

Le script accepte ce format directement et reconstruit son index de recherche au chargement. Les questions inconnues sont envoyées au moteur de validation/IA seulement lorsque le mode riddle est activé.
