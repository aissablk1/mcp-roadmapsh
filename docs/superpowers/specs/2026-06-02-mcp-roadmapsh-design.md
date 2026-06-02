---
title: "mcp-roadmapsh — Design & Spec"
date: 2026-06-02
auteur: Aïssa BELKOUSSA
statut: validé
tags: [mcp, roadmap-sh, typescript, design]
---

# mcp-roadmapsh — Serveur MCP pour roadmap.sh

## 1. Objectif

Exposer le contenu de [roadmap.sh](https://roadmap.sh) (roadmaps développeur,
best practices, questions d'entretien, idées de projets, vidéos) à un agent LLM
via le Model Context Protocol, avec une couche pédagogique (plans lisibles,
recommandation du prochain sujet) et un suivi de progression local.

Trois usages cumulés (choix utilisateur « Tous ») :
1. **Assistant d'apprentissage** — explorer, expliquer, recommander.
2. **Récupération de contenu brut** — JSON / markdown structuré.
3. **Suivi de progression perso** — état persisté sur disque.

## 2. Contraintes & principes

- **Vraies données uniquement (§2)** : aucune donnée mockée. Tout provient des
  sources officielles ci-dessous.
- **Zéro hallucination (§29)** : la liste des roadmaps/slugs est récupérée
  dynamiquement, jamais hardcodée.
- **Convention locale** : TypeScript / stdio, squelette identique à `mcp-graphviz`
  (`@modelcontextprotocol/sdk`, `zod`, `zod-to-json-schema`, annotations).
- **Sécurité** : aucune clé secrète, requêtes en lecture seule sur des endpoints
  publics, timeouts, normalisation d'erreurs, jamais de throw brut.

## 3. Sources de données (officielles, sans authentification)

| # | Source | Usage | Statut |
|---|--------|-------|--------|
| S1 | `https://roadmap.sh/{slug}.json` | Graphe d'un roadmap (nodes/edges) | vérifié |
| S2 | `https://raw.githubusercontent.com/kamranahmedse/developer-roadmap/master/src/data/...` | Markdown des topics, méta, best-practices, questions, projets, vidéos | repo open source |
| S3 | `https://api.github.com/repos/kamranahmedse/developer-roadmap/contents/src/data/{type}` | Listing dynamique des slugs | API publique GitHub |

`src/data/` contient : `roadmaps/`, `best-practices/`, `projects/`,
`question-groups/`, `videos/`, `authors/` (vérifié).

> Les chemins exacts des fichiers markdown/json par type seront confirmés par
> sondage réel avant l'implémentation (phase TDD), pas devinés.

## 4. Architecture (unités à responsabilité unique)

| Fichier | Rôle | Dépend de |
|---|---|---|
| `src/index.ts` | Bootstrap serveur, registre d'outils, handlers ListTools/CallTool | tools |
| `src/sources.ts` | Constructeurs d'URL + constantes des sources S1/S2/S3 | — |
| `src/fetcher.ts` | HTTP fetch + cache disque (TTL) + timeout + normalisation d'erreurs | sources |
| `src/format.ts` | Graphe JSON → plan lisible (outline), helpers pédagogiques | — |
| `src/progress.ts` | Lecture/écriture de l'état de progression (fichier JSON) | — |
| `src/tools.ts` | Schémas zod + handlers de chaque outil | fetcher, sources, format, progress |

**Cache** : `ROADMAPSH_CACHE_DIR` (défaut `~/.cache/mcp-roadmapsh/`), TTL 24 h.
**État** : `ROADMAPSH_STATE_DIR` (défaut `~/.local/state/mcp-roadmapsh/`),
fichier `progress.json`. Données runtime propres au serveur (convention XDG).

## 5. Outils exposés

### Roadmaps
- `roadmap_diagnose` — connectivité roadmap.sh + GitHub, état du cache. *(read-only)*
- `roadmap_list` — liste roadmaps role-based + skill-based (slug, titre). *(read-only)*
- `roadmap_get` — graphe d'un roadmap par slug ; `format: raw|outline`. *(read-only)*
- `roadmap_topic` — markdown + liens d'un topic donné. *(read-only)*
- `roadmap_search` — recherche par mot-clé (slugs, titres, topics). *(read-only)*

### Best practices
- `best_practices_list` / `best_practices_get`. *(read-only)*

### Questions
- `questions_list` / `questions_get` (flashcards d'un groupe). *(read-only)*

### Projects & vidéos
- `projects_list` (filtre optionnel par roadmap/difficulté). *(read-only)*
- `videos_list`. *(read-only)*

### Progression (état local)
- `progress_mark` — `{roadmap, topicId, status: learning|done|skip}`. *(écrit l'état, non destructif)*
- `progress_status` — `{roadmap}` → % complétion + listes par statut. *(read-only)*
- `progress_next` — recommande le prochain topic depuis l'outline + l'état. *(read-only)*

## 6. Gestion d'erreurs

- `fetcher` normalise : erreur réseau, 404 (slug inconnu → message renvoyant vers
  `roadmap_list`), timeout, JSON invalide.
- Validation zod en frontière ; en cas d'échec, `isError: true` + message clair
  (jamais de stack brute).
- `roadmap_diagnose` permet de diagnostiquer une coupure réseau / cache corrompu.

## 7. Tests (TDD, vraies données)

1. **`test-all.mjs`** — spawn du serveur, appel de chaque outil contre les vrais
   endpoints ; assertions sur la forme des réponses (au moins 1 roadmap listé, un
   graphe non vide pour `frontend`, etc.).
2. **Tests offline du formateur** — `format.ts` testé sur une fixture JSON réelle
   capturée depuis S1 (déterministe, sans réseau).
3. **Tests progression** — `progress.ts` testé sur un répertoire d'état temporaire.

Critère d'acceptation : `npm run build` vert + `node test-all.mjs` vert
(tous les outils répondent sans erreur sur des données réelles).

## 8. Hors-scope (YAGNI)

- Pas d'authentification / compte roadmap.sh.
- Pas de synchronisation cloud de la progression.
- Pas de rendu d'images du graphe.
- Pas d'écriture vers roadmap.sh (lecture seule côté distant).

## 9. Livrables

`package.json`, `tsconfig.json`, `src/*.ts`, `test-all.mjs`, `examples/`,
`README.md`, `PROJECT.nfo`, `.gitignore`.
