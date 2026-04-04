---
name: validate-schema
description: Compara el schema de DB (shared/schema.ts) contra el uso real en storage.ts y routes.ts
user-invocable: true
---

Verifica la consistencia entre el schema de Drizzle ORM y su uso en el backend.

## Pasos

1. Lee `shared/schema.ts` y extrae todas las tablas con sus columnas
2. Lee `server/storage.ts` y extrae todos los queries (select, insert, update, delete)
3. Lee `server/routes.ts` y busca accesos directos a `db` que no pasen por storage
4. Compara:

### Campos fantasma (en schema, nunca usados)
- Campos definidos en schema.ts que nunca se leen ni escriben en storage.ts o routes.ts
- Excluir: `id`, `createdAt`, `updatedAt` (generados automaticamente)

### Campos huerfanos (usados en codigo, no en schema)
- Campos referenciados en queries que no existen en el schema
- Esto indica un bug potencial o una migracion pendiente

### Relaciones rotas
- Foreign keys en schema que apuntan a tablas inexistentes
- Joins en storage.ts que usan campos sin FK definido

### Indices faltantes
- Campos usados frecuentemente en WHERE clauses que no tienen indice en el schema

5. Genera reporte:
   - Campos fantasma por tabla
   - Campos huerfanos por archivo
   - Relaciones rotas
   - Indices recomendados
   - Resumen: schema saludable o necesita limpieza
