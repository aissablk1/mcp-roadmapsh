# Exemples d'utilisation — mcp-roadmapsh

Appels types des 15 outils (arguments JSON tels que passés par le client MCP).

## Roadmaps

```jsonc
// Diagnostic de connectivité + cache
{ "tool": "roadmap_diagnose", "arguments": {} }

// Lister tous les roadmaps
{ "tool": "roadmap_list", "arguments": {} }

// Plan lisible d'un roadmap (recommandé)
{ "tool": "roadmap_get", "arguments": { "slug": "frontend", "format": "outline" } }

// Graphe brut (nodes/edges)
{ "tool": "roadmap_get", "arguments": { "slug": "backend", "format": "raw" } }

// Contenu d'un topic (nodeId issu de l'outline, ou recherche par titre)
{ "tool": "roadmap_topic", "arguments": { "slug": "frontend", "nodeId": "VlNNwIEDWqQXtqkHWJYzC" } }
{ "tool": "roadmap_topic", "arguments": { "slug": "frontend", "query": "internet" } }

// Recherche de slugs par mot-clé
{ "tool": "roadmap_search", "arguments": { "query": "react", "scope": "roadmaps" } }
```

## Best practices

```jsonc
{ "tool": "best_practices_list", "arguments": {} }
{ "tool": "best_practices_get", "arguments": { "slug": "frontend-performance", "format": "outline" } }
```

## Questions d'entretien

```jsonc
{ "tool": "questions_list", "arguments": {} }
{ "tool": "questions_get", "arguments": { "slug": "javascript" } }
```

## Projets & vidéos

```jsonc
{ "tool": "projects_list", "arguments": {} }
{ "tool": "project_get", "arguments": { "slug": "blogging-platform-api" } }
{ "tool": "videos_list", "arguments": {} }
```

## Suivi de progression (état local)

```jsonc
// Marquer un topic
{ "tool": "progress_mark", "arguments": { "roadmap": "frontend", "nodeId": "VlNNwIEDWqQXtqkHWJYzC", "status": "done", "label": "Internet" } }

// Pourcentage de complétion
{ "tool": "progress_status", "arguments": { "roadmap": "frontend" } }

// Prochain topic recommandé
{ "tool": "progress_next", "arguments": { "roadmap": "frontend" } }
```

## Démo exécutable

```bash
node examples/demo.mjs        # parcours réel : list -> outline -> topic -> next
```
