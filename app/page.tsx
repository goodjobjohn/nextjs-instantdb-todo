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
    const [activeListId, setActiveListId] = useState<string | null>(null);

    if (isLoading) {
        return <div>Fetching data...</div>;
    }
    if (error) {
        return <div>Error fetching data: {error.message}</div>;
    }

    const { todos, lists } = data;

    const activeTodos = todos.filter((todo) => todo.listId === activeListId);
    const activeList = lists.find((list) => list.id === activeListId);

    return (
        <div style={styles.container}>
            <div style={styles.header}>todos</div>
            <button onClick={addList} style={styles.addListButton}>
                Add List
            </button>
            <div style={styles.listSelector}>
                {lists.map((list) => (
                    <button
                        key={list.id}
                        onClick={() => setActiveListId(list.id)}
                        style={{
                            ...styles.listButton,
                            backgroundColor:
                                activeListId === list.id
                                    ? "#e6e6e6"
                                    : "transparent",
                        }}
                    >
                        {list.name}
                    </button>
                ))}
            </div>
            {activeList && (
                <>
                    <TodoForm todos={activeTodos} listId={activeListId} />
                    <TodoList todos={activeTodos} />
                    <ActionBar todos={activeTodos} />
                </>
            )}
            <div style={styles.footer}>
                Open another tab to see todos update in realtime!
            </div>
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
            <div>
                Remaining todos: {todos.filter((todo) => !todo.done).length}
            </div>
            <div
                style={{ cursor: "pointer" }}
                onClick={() => deleteCompleted(todos)}
            >
                Delete Completed
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
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
    },
    header: {
        letterSpacing: "2px",
        fontSize: "50px",
        color: "lightgray",
        marginBottom: "10px",
    },
    form: {
        boxSizing: "inherit",
        display: "flex",
        border: "1px solid lightgray",
        borderBottomWidth: "0px",
        width: "350px",
    },
    toggleAll: {
        fontSize: "30px",
        cursor: "pointer",
        marginLeft: "11px",
        marginTop: "-6px",
        width: "15px",
        marginRight: "12px",
    },
    input: {
        backgroundColor: "transparent",
        fontFamily: "code, monospace",
        width: "287px",
        padding: "10px",
        fontStyle: "italic",
    },
    todoList: {
        boxSizing: "inherit",
        width: "350px",
    },
    checkbox: {
        fontSize: "30px",
        marginLeft: "5px",
        marginRight: "20px",
        cursor: "pointer",
    },
    todo: {
        display: "flex",
        alignItems: "center",
        padding: "10px",
        border: "1px solid lightgray",
        borderBottomWidth: "0px",
    },
    todoText: {
        flexGrow: "1",
        overflow: "hidden",
    },
    delete: {
        width: "25px",
        cursor: "pointer",
        color: "lightgray",
    },
    actionBar: {
        display: "flex",
        justifyContent: "space-between",
        width: "328px",
        padding: "10px",
        border: "1px solid lightgray",
        fontSize: "10px",
    },
    footer: {
        marginTop: "20px",
        fontSize: "10px",
    },
    addListButton: {
        marginBottom: "10px",
        padding: "5px 10px",
        fontSize: "14px",
        cursor: "pointer",
    },
    listSelector: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        marginBottom: "10px",
    },
    listButton: {
        margin: "0 5px 5px 0",
        padding: "5px 10px",
        fontSize: "14px",
        cursor: "pointer",
        border: "1px solid lightgray",
        borderRadius: "3px",
    },
};

export default App;
