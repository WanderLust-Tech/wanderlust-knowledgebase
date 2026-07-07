---
description: Scaffold a new knowledge-base document — creates the .md file, adds a ContentNode to contentIndex.ts, and updates the search index. Usage: /new-doc <subject>/<category>/<filename> "Title"
---

Create a new document in the wanderlust-knowledgebase. The user provides a path and title:

```
/new-doc chromium/architecture/my-new-topic "My New Topic"
```

If the user omits the title, infer one from the filename (kebab-case → Title Case).

## Steps

1. **Parse the arguments**
   - Path: everything before the quoted title — e.g. `chromium/architecture/my-new-topic`
   - Subject: first segment — e.g. `chromium`
   - Title: the quoted string, or inferred from filename

2. **Create the markdown file**

   Write to `public/content/<path>.md`. Use this frontmatter scaffold:
   ```yaml
   ---
   title: "<Title>"
   description: ""
   category: ""      # Architecture | Security | APIs | Development | Debugging | Accessibility | Performance
   tags: []
   difficulty: "intermediate"    # beginner | intermediate | advanced
   date: "<today's date YYYY-MM-DD>"
   author: "Wanderlust Team"
   estimated_reading_time: "5 minutes"
   ---
   ```
   Follow the frontmatter with:
   ```markdown
   # <Title>

   ## Overview

   <!-- TODO: write overview -->

   ## Key Concepts

   <!-- TODO: fill in key concepts -->
   ```

3. **Add a ContentNode to `src/contentIndex.ts`**

   - Read `src/contentIndex.ts` and locate the correct Subject (`id` matches the subject segment).
   - Find the appropriate parent node by matching the category/subcategory path.
   - Insert a new `ContentNode` at the end of the parent's `children` array:
     ```typescript
     { title: "<Title>", path: "<category>/<filename>" }
     ```
   - **Path format:** no `.md` extension, forward slashes — e.g. `"architecture/my-new-topic"`.
   - If the parent node doesn't exist, ask the user where to nest it before editing.

4. **Remind the user**

   After writing both files, output:
   > File created at `public/content/<path>.md` and added to `contentIndex.ts`.
   > Run `npm run build-index` to make the document searchable.
   > Fill in the `description`, `category`, `tags`, and `difficulty` frontmatter fields.
