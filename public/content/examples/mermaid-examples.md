# Mermaid Diagram Examples

This document demonstrates various Mermaid diagram types that are now supported in the Wanderlust Knowledge Base.

## Flowchart Example

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
```

## Sequence Diagram Example

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Server
    
    User->>Browser: Open application
    Browser->>Server: Request content
    Server-->>Browser: Return HTML/CSS/JS
    Browser-->>User: Render page
    
    User->>Browser: Interact with UI
    Browser->>Server: API call
    Server-->>Browser: JSON response
    Browser-->>User: Update UI
```

## Component Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend"
        UI[React Components]
        State[State Management]
        Router[React Router]
    end
    
    subgraph "Backend"
        API[REST API]
        Auth[Authentication]
        DB[(Database)]
    end
    
    UI --> State
    UI --> Router
    State --> API
    API --> Auth
    API --> DB
```

## Git Workflow Diagram

```mermaid
gitgraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Feature A"
    commit id: "Feature B"
    checkout main
    merge develop
    commit id: "Release v1.0"
```

## Class Diagram Example

```mermaid
classDiagram
    class MermaidDiagram {
        +string chart
        +string className
        +render() void
        +handleError() void
    }
    
    class CodeBlock {
        +string children
        +string language
        +boolean inline
        +detectMermaid() boolean
    }
    
    MermaidDiagram <|-- CodeBlock : uses
```

## Pie Chart Example

```mermaid
pie title Browser Usage Statistics
    "Chrome" : 42.7
    "Firefox" : 27.3
    "Safari" : 15.4
    "Edge" : 8.9
    "Other" : 5.7
```

## State Diagram Example

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Success : Data loaded
    Loading --> Error : Failed to load
    Success --> Loading : Refresh
    Error --> Loading : Retry
    Success --> [*]
    Error --> [*]
```