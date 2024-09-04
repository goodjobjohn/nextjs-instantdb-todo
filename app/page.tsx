"use client";

import React, { useState } from "react";
import { init, tx, id } from "@instantdb/react";

// ID for app: Instant Tutorial Todo App
const APP_ID = "3e6a8c32-d007-46c9-8de4-1065d6233247";

// Optional: Declare your schema for intellisense!
type Schema = {
    todos: Todo;
    lists: TodoList;
};

const db = init<Schema>({ appId: APP_ID });

function App() {
    const { isLoading, error, data } = db.useQuery({ todos: {}, lists: {} });

    if (isLoading) {
        return <div>Fetching data...</div>;
    }
    if (error) {
        return <div>Error fetching data: {error.message}</div>;
    }

    const { todos, lists } = data;

    return (
        <div style={styles.container}>
            <button onClick={addList} style={styles.addListButton}>
                Add List
            </button>
            <div style={styles.listsContainer}>
                {lists.map((list) => (
                    <TodoListComponent
                        key={list.id}
                        list={list}
                        todos={todos.filter((todo) => todo.listId === list.id)}
                    />
                ))}
            </div>
            <div style={styles.footer}>
                Open another tab to see todos update in realtime!
            </div>
        </div>
    );
}

function TodoListComponent({ list, todos }: { list: TodoList; todos: Todo[] }) {
    return (
        <div style={styles.listContainer}>
            <h3 style={styles.listTitle}>{list.name}</h3>
            <TodoForm todos={todos} listId={list.id} />
            <TodoList todos={todos} />
            <ActionBar todos={todos} />
        </div>
    );
}

// Write Data
// ---------
function addList() {
    const newListName = prompt("Enter a name for the new list:");
    if (newListName) {
        db.transact(
            tx.lists[id()].update({
                name: newListName,
                createdAt: Date.now(),
            })
        );
    }
}

function addTodo(text: string, listId: string) {
    db.transact(
        tx.todos[id()].update({
            text,
            done: false,
            createdAt: Date.now(),
            listId,
        })
    );
}

function deleteTodo(todo: Todo) {
    db.transact(tx.todos[todo.id].delete());
}

function toggleDone(todo: Todo) {
    db.transact(tx.todos[todo.id].update({ done: !todo.done }));
}

function deleteCompleted(todos: Todo[]) {
    const completed = todos.filter((todo) => todo.done);
    const txs = completed.map((todo) => tx.todos[todo.id].delete());
    db.transact(txs);
}

function toggleAll(todos: Todo[]) {
    const newVal = !todos.every((todo) => todo.done);
    db.transact(
        todos.map((todo) => tx.todos[todo.id].update({ done: newVal }))
    );
}

// Components
// ----------
function TodoForm({ todos, listId }: { todos: Todo[]; listId: string }) {
    return (
        <div style={styles.form}>
            <div style={styles.toggleAll} onClick={() => toggleAll(todos)}>
                ⌄
            </div>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.target[0] as HTMLInputElement;
                    addTodo(input.value, listId);
                    input.value = "";
                }}
            >
                <input
                    style={styles.input}
                    autoFocus
                    placeholder="What needs to be done?"
                    type="text"
                />
            </form>
        </div>
    );
}

function TodoList({ todos }: { todos: Todo[] }) {
    return (
        <div style={styles.todoList}>
            {todos.map((todo) => (
                <div key={todo.id} data-id={todo.id} style={styles.todo}>
                    <input
                        type="checkbox"
                        key={todo.id}
                        style={styles.checkbox}
                        checked={todo.done}
                        onChange={() => toggleDone(todo)}
                    />
                    <div style={styles.todoText}>
                        {todo.done ? (
                            <span style={{ textDecoration: "line-through" }}>
                                {todo.text}
                            </span>
                        ) : (
                            <span>{todo.text}</span>
                        )}
                    </div>
                    <span
                        onClick={() => deleteTodo(todo)}
                        style={styles.delete}
                    >
                        𝘟
                    </span>
                </div>
            ))}
        </div>
    );
}

function ActionBar({ todos }: { todos: Todo[] }) {
    return (
        <div style={styles.actionBar}>
            <div>Remaining: {todos.filter((todo) => !todo.done).length}</div>
            <div
                style={{ cursor: "pointer" }}
                onClick={() => deleteCompleted(todos)}
            >
                Clear Completed
            </div>
        </div>
    );
}

// Types
// ----------
type Todo = {
    id: string;
    text: string;
    done: boolean;
    createdAt: number;
    listId: string;
};

type TodoList = {
    id: string;
    name: string;
    createdAt: number;
};

// Styles
// ----------
const styles: Record<string, React.CSSProperties> = {
    container: {
        boxSizing: "border-box",
        backgroundColor: "#fafafa",
        fontFamily: "code, monospace",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px",
    },
    header: {
        letterSpacing: "2px",
        fontSize: "50px",
        color: "lightgray",
        marginBottom: "10px",
    },
    listsContainer: {
        display: "flex",
        overflowX: "auto",
        width: "100%",
        padding: "20px 0",
    },
    listContainer: {
        minWidth: "300px",
        maxWidth: "300px",
        marginRight: "20px",
        backgroundColor: "white",
        borderRadius: "5px",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        display: "flex",
        flexDirection: "column",
    },
    listTitle: {
        padding: "10px",
        margin: "0",
        borderBottom: "1px solid #f0f0f0",
    },
    form: {
        boxSizing: "inherit",
        display: "flex",
        borderBottom: "1px solid #f0f0f0",
        padding: "10px",
    },
    toggleAll: {
        fontSize: "20px",
        cursor: "pointer",
        marginRight: "10px",
    },
    input: {
        backgroundColor: "transparent",
        fontFamily: "inherit",
        flex: 1,
        border: "none",
        outline: "none",
        fontSize: "14px",
    },
    todoList: {
        flex: 1,
        overflowY: "auto",
    },
    todo: {
        display: "flex",
        alignItems: "center",
        padding: "10px",
        borderBottom: "1px solid #f0f0f0",
    },
    checkbox: {
        marginRight: "10px",
        cursor: "pointer",
    },
    todoText: {
        flexGrow: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    delete: {
        cursor: "pointer",
        color: "lightgray",
        marginLeft: "10px",
    },
    actionBar: {
        display: "flex",
        justifyContent: "space-between",
        padding: "10px",
        fontSize: "12px",
        borderTop: "1px solid #f0f0f0",
    },
    footer: {
        marginTop: "20px",
        fontSize: "12px",
        color: "gray",
    },
    addListButton: {
        marginBottom: "10px",
        padding: "5px 10px",
        fontSize: "14px",
        cursor: "pointer",
        backgroundColor: "#4CAF50",
        color: "white",
        border: "none",
        borderRadius: "3px",
    },
};

export default App;
