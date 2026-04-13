# Using Mermaid Diagrams

The Wanderlust Knowledge Base now supports [Mermaid](https://mermaid.js.org/) diagrams, allowing you to create beautiful, interactive diagrams directly in your markdown content.

## Quick Start

To add a Mermaid diagram to any markdown file, use a code block with the `mermaid` language identifier:

````markdown
```mermaid
graph TD
    A[Start] --> B[Process] --> C[End]
```
````

## Supported Diagram Types

### 1. Flowcharts
Create process flows, decision trees, and workflow diagrams:

````markdown
```mermaid
graph TD
    A[Square] --> B{Decision}
    B -->|Yes| C[Result 1]
    B -->|No| D[Result 2]
```
````

### 2. Sequence Diagrams
Visualize interactions between different actors:

````markdown
```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob
    B-->>A: Hello Alice
```
````

### 3. Class Diagrams
Document software architecture and relationships:

````markdown
```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +String breed
        +bark()
    }
    Animal <|-- Dog
```
````

### 4. State Diagrams
Show states and transitions in systems:

````markdown
```mermaid
stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]
```
````

### 5. Gantt Charts
Project timelines and schedules:

````markdown
```mermaid
gantt
    title Development Schedule
    dateFormat  YYYY-MM-DD
    section Design
    Research    :done, des1, 2024-01-01, 2024-01-05
    Mockups     :active, des2, 2024-01-06, 3d
    section Development
    Frontend    :dev1, after des2, 5d
    Backend     :dev2, after des2, 7d
```
````

### 6. Pie Charts
Show data distributions:

````markdown
```mermaid
pie title Browsers
    "Chrome" : 42.7
    "Firefox" : 27.3
    "Safari" : 15.4
    "Edge" : 8.9
    "Other" : 5.7
```
````

## Features

### Theme Support
Diagrams automatically adapt to the current theme (light/dark mode) of the knowledge base.

### Error Handling
If a diagram has syntax errors, an error message will be displayed with the option to view the source code for debugging.

### Responsive Design
All diagrams are responsive and will scale appropriately on different screen sizes.

### Copy Support
While you can't copy diagrams directly, you can view the source code and copy it for reuse.

## Best Practices

### 1. Keep It Simple
- Start with simple diagrams and add complexity gradually
- Use clear, descriptive labels
- Avoid overcrowding diagrams

### 2. Consistent Naming
- Use consistent naming conventions for nodes and connections
- Use meaningful IDs and labels

### 3. Documentation
- Add titles to complex diagrams
- Include explanatory text before or after diagrams
- Use comments in Mermaid code when useful

### 4. Performance
- Large, complex diagrams may take longer to render
- Consider breaking very complex diagrams into smaller parts

## Examples in Practice

### Chromium Build Process
```mermaid
graph TB
    A[Source Code] --> B[GN Generate]
    B --> C[Ninja Build]
    C --> D{Build Success?}
    D -->|Yes| E[Run Tests]
    D -->|No| F[Check Errors]
    F --> G[Fix Issues]
    G --> B
    E --> H[Package]
    H --> I[Deploy]
```

### Browser Component Architecture
```mermaid
graph TD
    subgraph "Chromium"
        R[Renderer Process]
        B[Browser Process]
        G[GPU Process]
        N[Network Service]
    end
    
    subgraph "Custom Browser"
        UI[Custom UI]
        F[Custom Features]
        P[Custom Plugins]
    end
    
    UI --> B
    F --> R
    P --> G
    B --> N
```

## Troubleshooting

### Common Issues

1. **Diagram not rendering**: Check your Mermaid syntax using the [Mermaid Live Editor](https://mermaid.live/)
2. **Styling issues**: The theme is automatically applied; manual styling may conflict
3. **Performance**: Very large diagrams may be slow to render

### Getting Help

- Visit the [Mermaid documentation](https://mermaid.js.org/intro/)
- Use the [Mermaid Live Editor](https://mermaid.live/) to test syntax
- Check the browser console for error messages

## Version Information

- Mermaid version: 11.4.0
- Supported in: All modern browsers
- Theme support: Automatic light/dark mode detection