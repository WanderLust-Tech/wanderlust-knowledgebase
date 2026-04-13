# Code Playground Demo

Welcome to the interactive Code Playground! This feature allows you to write, edit, and execute code directly in the browser. Perfect for learning, experimenting, and testing code concepts.

## JavaScript Playground

Let's start with a simple JavaScript example. Try modifying the code and click "Run" to see the results:

### Basic JavaScript Example

```javascript
// Welcome to the JavaScript playground!
// Try modifying this code and clicking "Run"

function greetUser(name) {
    return `Hello, ${name}! Welcome to the Wanderlust Knowledge Base.`;
}

function calculateFactorial(n) {
    if (n <= 1) return 1;
    return n * calculateFactorial(n - 1);
}

// Test the functions
console.log(greetUser("Developer"));
console.log("Factorial of 5:", calculateFactorial(5));

// Try some array methods
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Original:", numbers);
console.log("Doubled:", doubled);

// Return a value to see it in the output
"JavaScript playground is working!"
```

**Instructions:** Modify the code above, add your own functions, or try different JavaScript features. The console output will appear below the editor.

---

## Advanced JavaScript: DOM and Modern Features

This playground demonstrates more advanced JavaScript concepts:

### ES6+ Features and Async Programming

```javascript
// Modern JavaScript features demonstration

// Destructuring and arrow functions
const user = { name: "Alice", age: 30, city: "New York" };
const { name, age } = user;
console.log(`User: ${name}, Age: ${age}`);

// Template literals and spread operator
const hobbies = ["reading", "coding"];
const moreHobbies = [...hobbies, "hiking", "photography"];
console.log("Hobbies:", moreHobbies.join(", "));

// Async/await simulation (using setTimeout)
async function simulateApiCall() {
    console.log("Starting API call...");
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ data: "API response data", status: "success" });
        }, 1000);
    });
}

// Class syntax
class Calculator {
    constructor(name) {
        this.name = name;
    }
    
    add(a, b) {
        console.log(`${this.name} calculating: ${a} + ${b} = ${a + b}`);
        return a + b;
    }
    
    multiply(a, b) {
        console.log(`${this.name} calculating: ${a} × ${b} = ${a * b}`);
        return a * b;
    }
}

// Test the class
const calc = new Calculator("MyCalculator");
calc.add(5, 3);
calc.multiply(4, 7);

// Call the async function
simulateApiCall().then(result => {
    console.log("API Result:", result);
});

"Advanced JavaScript concepts demo complete!"
```

**Instructions:** This example shows ES6+ features, classes, async/await, and more. Try adding your own modern JavaScript code!

---

## HTML/CSS Playground

Create interactive web content with HTML and CSS:

### Interactive HTML Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Demo</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 10px 0;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        button {
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        button:hover {
            background: #ff5252;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .counter {
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>Interactive HTML Demo</h1>
        <p>This is a live HTML/CSS example running in the browser!</p>
        
        <div class="counter">
            Count: <span id="count">0</span>
        </div>
        
        <button onclick="increment()">Click Me!</button>
        <button onclick="reset()">Reset</button>
    </div>
    
    <div class="card">
        <h2>Features</h2>
        <ul>
            <li>Responsive design</li>
            <li>Modern CSS with gradients and blur effects</li>
            <li>Interactive JavaScript</li>
            <li>Smooth animations</li>
        </ul>
    </div>

    <script>
        let count = 0;
        const countElement = document.getElementById('count');
        
        function increment() {
            count++;
            countElement.textContent = count;
            
            // Add some fun effects
            if (count % 10 === 0) {
                document.body.style.background = `linear-gradient(135deg, 
                    hsl(${count * 10}, 70%, 60%) 0%, 
                    hsl(${count * 15}, 70%, 40%) 100%)`;
            }
        }
        
        function reset() {
            count = 0;
            countElement.textContent = count;
            document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
    </script>
</body>
</html>
```

**Instructions:** This HTML example includes CSS styling and JavaScript interactivity. Try modifying the styles, adding new elements, or changing the JavaScript logic!

---

## TypeScript Playground

Experience TypeScript's powerful type system:

### TypeScript Interfaces and Generics

```typescript
// TypeScript playground with interfaces and generics

interface User {
    id: number;
    name: string;
    email: string;
    isActive?: boolean;
}

interface ApiResponse<T> {
    data: T;
    status: 'success' | 'error';
    message?: string;
}

// Generic function
function createApiResponse<T>(data: T, status: 'success' | 'error'): ApiResponse<T> {
    return { data, status };
}

// Class with generics
class DataStore<T> {
    private items: T[] = [];
    
    add(item: T): void {
        this.items.push(item);
        console.log(`Added item:`, item);
    }
    
    getAll(): T[] {
        return [...this.items];
    }
    
    find(predicate: (item: T) => boolean): T | undefined {
        return this.items.find(predicate);
    }
}

// Usage examples
const userStore = new DataStore<User>();

const users: User[] = [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", isActive: true },
    { id: 2, name: "Bob Smith", email: "bob@example.com", isActive: false },
    { id: 3, name: "Carol Davis", email: "carol@example.com", isActive: true }
];

users.forEach(user => userStore.add(user));

console.log("All users:", userStore.getAll());

const activeUser = userStore.find(user => user.isActive === true);
console.log("First active user:", activeUser);

// API response example
const response = createApiResponse(users, 'success');
console.log("API Response:", response);

// Type checking in action
// This would cause a TypeScript error:
// userStore.add("invalid user"); // Error: string is not assignable to User

"TypeScript playground working with full type safety!"
```

**Instructions:** This TypeScript example demonstrates interfaces, generics, and type safety. Try adding new types or modifying the existing ones!

---

## Learning Exercises

### Exercise 1: JavaScript Algorithm Practice

```javascript
// Algorithm practice: Implement a simple sorting algorithm
// TODO: Complete the bubble sort implementation

function bubbleSort(arr) {
    // Your implementation here
    // Hint: Use nested loops to compare adjacent elements
    
    return arr;
}

// Test your implementation
const testArray = [64, 34, 25, 12, 22, 11, 90];
console.log("Original array:", testArray);
console.log("Sorted array:", bubbleSort([...testArray]));

// Expected output: [11, 12, 22, 25, 34, 64, 90]
```

**Expected Output:**
```
Original array: [64, 34, 25, 12, 22, 11, 90]
Sorted array: [11, 12, 22, 25, 34, 64, 90]
```

### Exercise 2: Build a Todo List

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; }
        .todo-item { padding: 10px; margin: 5px 0; background: #f0f0f0; border-radius: 5px; }
        .completed { text-decoration: line-through; opacity: 0.6; }
        input, button { padding: 8px; margin: 5px; }
        button { background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>Todo List</h1>
    <div>
        <input type="text" id="todoInput" placeholder="Enter a new task...">
        <button onclick="addTodo()">Add Task</button>
    </div>
    <div id="todoList"></div>

    <script>
        let todos = [];
        let nextId = 1;

        function addTodo() {
            const input = document.getElementById('todoInput');
            const text = input.value.trim();
            
            if (text) {
                todos.push({ id: nextId++, text, completed: false });
                input.value = '';
                renderTodos();
            }
        }

        function toggleTodo(id) {
            const todo = todos.find(t => t.id === id);
            if (todo) {
                todo.completed = !todo.completed;
                renderTodos();
            }
        }

        function deleteTodo(id) {
            todos = todos.filter(t => t.id !== id);
            renderTodos();
        }

        function renderTodos() {
            const list = document.getElementById('todoList');
            list.innerHTML = todos.map(todo => `
                <div class="todo-item ${todo.completed ? 'completed' : ''}">
                    <span onclick="toggleTodo(${todo.id})" style="cursor: pointer;">
                        ${todo.completed ? '✅' : '⬜'} ${todo.text}
                    </span>
                    <button onclick="deleteTodo(${todo.id})" style="float: right; background: #dc3545;">Delete</button>
                </div>
            `).join('');
        }

        // Add some sample todos
        todos = [
            { id: 1, text: "Learn JavaScript", completed: true },
            { id: 2, text: "Build a todo app", completed: false },
            { id: 3, text: "Master React", completed: false }
        ];
        nextId = 4;
        renderTodos();
    </script>
</body>
</html>
```

**Instructions:** This is a fully functional todo list! Try adding new features like editing tasks, filtering by completion status, or saving to localStorage.

---

## Code Playground Features

The Code Playground includes:

- ✅ **Multi-language Support**: JavaScript, TypeScript, HTML, CSS, Python, C++
- ✅ **Live Code Execution**: Run JavaScript and TypeScript code instantly
- ✅ **Monaco Editor**: Full VS Code editor experience with IntelliSense
- ✅ **Console Output**: See console.log output and errors
- ✅ **Code Sharing**: Copy code to clipboard easily
- ✅ **Reset Functionality**: Return to original code anytime
- ✅ **Solution Toggle**: Show/hide solutions for learning exercises
- ✅ **Theme Awareness**: Automatically matches your preferred theme
- ✅ **Keyboard Shortcuts**: Ctrl/Cmd + Enter to run code
- ✅ **File Tabs**: Support for multi-file projects
- ✅ **Error Handling**: Graceful error display and debugging

This interactive learning environment makes it easy to experiment with code, learn new concepts, and test ideas without leaving the documentation!
