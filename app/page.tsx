"use client";

import React, { useState, useRef, useEffect } from "react";
import { init, tx, id } from "@instantdb/react";
import {
    dropTargetForElements,
    monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";

import "./app.css";

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
        <div className="container" style={styles.container}>
            <div style={styles.header}>freeflow</div>
            <button onClick={addList} style={styles.addListButton}>
                Add List
            </button>
            <div className="listsContainer" style={styles.listsContainer}>
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
    const [, forceUpdate] = useState({});

    const onDragStart = () => {
        forceUpdate({});
    };

    const onDragEnd = (source: Todo, destination: Todo | TodoList) => {
        console.log('Source:', JSON.stringify(source, null, 2));
        console.log('Destination:', JSON.stringify(destination, null, 2));

        if (!source || !source.id) {
            console.error('Invalid source object:', source);
            return;
        }

        let transactionSteps;
        if ('name' in destination) {
            // Dropping onto a different list
            const maxOrder = Math.max(...todos.filter(t => t.listId === destination.id).map(t => t.order || 0), 0);
            transactionSteps = [
                tx.todos[source.id].update({ 
                    listId: destination.id,
                    order: maxOrder + 1,
                })
            ];
        } else {
            // Reordering within the same list
            const sourceIndex = todos.findIndex(t => t.id === source.id);
            const destIndex = todos.findIndex(t => t.id === destination.id);
            const newOrder = calculateNewOrder(todos, sourceIndex, destIndex);
            transactionSteps = [
                tx.todos[source.id].update({ order: newOrder })
            ];
        }
        
        console.log('Transaction steps:', JSON.stringify(transactionSteps, null, 2));
        
        if (transactionSteps && transactionSteps.length > 0) {
            db.transact(transactionSteps);
        } else {
            console.error('No valid transaction steps generated');
        }
    };

    return (
        <div className="listContainer" style={styles.listContainer}>
            <h3 style={styles.listTitle}>{list.name}</h3>
            <TodoList
                todos={todos}
                listId={list.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            />
            <ActionBar todos={todos} listId={list.id} />
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

function addTodo(listId: string, todos: Todo[]) {
    const newTodoId = id();
    const maxOrder = Math.max(...todos.map(t => t.order || 0), 0);
    db.transact(
        tx.todos[newTodoId].update({
            text: "",
            done: false,
            createdAt: Date.now(),
            listId,
            order: maxOrder + 1,
        })
    );
    // Focus on the new todo item after a short delay
    setTimeout(() => {
        const newTodoElement = document.getElementById(`todo-${newTodoId}`);
        if (newTodoElement) {
            newTodoElement.focus();
        }
    }, 50);
}

function deleteTodo(todo: Todo) {
    db.transact(tx.todos[todo.id].delete());
}

function toggleDone(todo: Todo) {
    db.transact(tx.todos[todo.id].update({ done: !todo.done }));
}

function updateTodoText(todo: Todo, newText: string) {
    db.transact(tx.todos[todo.id].update({ 
        text: newText,
        order: todo.order || Date.now(),
    }));
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
function TodoList({ todos, listId, onDragStart, onDragEnd }: { todos: Todo[]; listId: string; onDragStart: () => void; onDragEnd: (source: Todo, destination: Todo | TodoList) => void }) {
    const sortedTodos = [...todos].sort((a, b) => (a.order || 0) - (b.order || 0));
    const listRef = useRef<HTMLDivElement>(null);
    const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

    useEffect(() => {
        if (!listRef.current) return;

        const cleanup = combine(
            dropTargetForElements({
                element: listRef.current,
                getData: () => ({ id: listId, name: 'List' }),
                canDrop: (args) => {
                    console.log('canDrop args:', JSON.stringify({
                        sourceData: args.source.data,
                        targetId: listId
                    }, null, 2));
                    // Allow dropping from any list, including the same one
                    return args.source.data && args.source.data.listId;
                },
                onDrag: (args) => {
                    console.log('onDrag args:', JSON.stringify({
                        sourceData: args.source.data,
                    }, null, 2));
                    if (args.source.element) {
                        args.source.element.style.opacity = '0.5';
                    }
                    
                    // Update drop indicator position
                    if (listRef.current) {
                        const listRect = listRef.current.getBoundingClientRect();
                        const y = args.location.current.input.clientY;
                        const index = Math.floor((y - listRect.top) / 40); // Assuming each item is 40px high
                        setDropIndicatorIndex(Math.max(0, Math.min(index, sortedTodos.length)));
                    }
                },
                onDragLeave: (args) => {
                    console.log('onDragLeave args:', JSON.stringify({
                        sourceData: args.source.data,
                    }, null, 2));
                    if (args.source.element) {
                        args.source.element.style.opacity = '1';
                    }
                    setDropIndicatorIndex(null);
                },
                onDrop: (args) => {
                    console.log('onDrop args:', JSON.stringify({
                        sourceData: args.source.data,
                    }, null, 2));
                    if (args.source.element) {
                        args.source.element.style.opacity = '1';
                    }
                    if (args.source.data) {
                        const sourceTodo = args.source.data as Todo;
                        if (sourceTodo.listId !== listId) {
                            // Dropping onto a different list
                            onDragEnd(sourceTodo, { id: listId, name: 'List', createdAt: Date.now() });
                        } else {
                            // Reordering within the same list
                            const destinationIndex = dropIndicatorIndex !== null ? dropIndicatorIndex : sortedTodos.length;
                            const destinationTodo = sortedTodos[destinationIndex] || { id: 'end', listId, order: Number.MAX_SAFE_INTEGER };
                            onDragEnd(sourceTodo, destinationTodo);
                        }
                    } else {
                        console.error('Drop event occurred but source data is missing');
                    }
                    setDropIndicatorIndex(null);
                },
            }),
            monitorForElements({
                onDragStart: (args) => {
                    console.log('onDragStart args:', JSON.stringify({
                        sourceData: args.source.data,
                    }, null, 2));
                    onDragStart();
                },
                onDrop: (args) => {
                    console.log('monitor onDrop args:', JSON.stringify({
                        sourceData: args.source.data,
                    }, null, 2));
                    onDragStart();
                    setDropIndicatorIndex(null);
                },
            })
        );

        return cleanup;
    }, [listId, onDragEnd, onDragStart, sortedTodos]);

    return (
        <div ref={listRef} style={styles.todoList}>
            {sortedTodos.map((todo, index) => (
                <React.Fragment key={todo.id}>
                    {dropIndicatorIndex === index && <div style={styles.dropIndicator} />}
                    <TodoItem todo={todo} listId={listId} todos={sortedTodos} onDragEnd={onDragEnd} />
                </React.Fragment>
            ))}
            {dropIndicatorIndex === sortedTodos.length && <div style={styles.dropIndicator} />}
        </div>
    );
}

function TodoItem({ todo, listId, todos, onDragEnd }: { todo: Todo; listId: string; todos: Todo[]; onDragEnd: (source: Todo, destination: Todo | TodoList) => void }) {
    const [text, setText] = useState(todo.text);
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setText(todo.text);
    }, [todo.text]);

    useEffect(() => {
        if (!itemRef.current) return;

        const cleanup = combine(
            draggable({
                element: itemRef.current,
                getInitialData: () => todo,
            }),
            dropTargetForElements({
                element: itemRef.current,
                getData: () => todo,
                onDrop: (args) => {
                    console.log('TodoItem onDrop args:', JSON.stringify({
                        sourceData: args.source.data,
                    }, null, 2));
                    if (args.source.data) {
                        onDragEnd(args.source.data as Todo, todo);
                    } else {
                        console.error('Drop event occurred in TodoItem but source data is missing');
                    }
                },
            })
        );

        return cleanup;
    }, [todo, onDragEnd]);

    const handleBlur = () => {
        if (text.trim() === "") {
            deleteTodo(todo);
        } else if (text !== todo.text) {
            updateTodoText(todo, text);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTodoBelow(listId, todo.id, todos);
        }
    };

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);
        const position = range?.startOffset;

        setText(e.currentTarget.textContent || "");

        setTimeout(() => {
            if (range) {
                range.setStart(range.startContainer, position || 0);
                range.setEnd(range.endContainer, position || 0);
                selection?.removeAllRanges();
                selection?.addRange(range);
            }
        }, 0);
    };

    return (
        <div ref={itemRef} className="item" style={styles.todo}>
            <input
                type="checkbox"
                style={styles.checkbox}
                checked={todo.done}
                onChange={() => toggleDone(todo)}
            />
            <div
                id={`todo-${todo.id}`}
                ref={contentEditableRef}
                contentEditable
                suppressContentEditableWarning
                style={{
                    ...styles.todoText,
                    textDecoration: todo.done ? "line-through" : "none",
                }}
                onInput={handleInput}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            >
                {text}
            </div>
            <span
                className="itemDelete"
                onClick={() => deleteTodo(todo)}
                style={styles.delete}
            >
                ⅹ
            </span>
        </div>
    );
}

function ActionBar({ todos, listId }: { todos: Todo[]; listId: string }) {
    return (
        <div className="actionBar" style={styles.actionBar}>
            <div>Remaining: {todos.filter((todo) => !todo.done).length}</div>
            <button
                onClick={() => addTodo(listId, todos)}
                style={styles.addTodoButton}
            >
                +
            </button>
            <div
                style={{ cursor: "pointer" }}
                onClick={() => deleteCompleted(todos)}
            >
                Clear Completed
            </div>
        </div>
    );
}

// Add this new function
function addTodoBelow(listId: string, currentTodoId: string, todos: Todo[]) {
    const newTodoId = id();
    const currentIndex = todos.findIndex(t => t.id === currentTodoId);
    const newOrder = currentIndex !== -1 && currentIndex < todos.length - 1
        ? (todos[currentIndex].order || 0 + todos[currentIndex + 1].order || 0) / 2
        : (todos[currentIndex].order || 0) + 1;

    db.transact([
        tx.todos[newTodoId].update({
            text: "",
            done: false,
            createdAt: Date.now(),
            listId,
            order: newOrder,
        }),
        ...todos.slice(currentIndex + 1).map((t, index) => 
            tx.todos[t.id].update({ order: newOrder + index + 1 })
        )
    ]);

    // Focus on the new todo item after a short delay
    setTimeout(() => {
        const newTodoElement = document.getElementById(`todo-${newTodoId}`);
        if (newTodoElement) {
            newTodoElement.focus();
        }
    }, 50);
}

// Helper function to calculate new order
function calculateNewOrder(todos: Todo[], sourceIndex: number, destIndex: number): number {
    if (sourceIndex === destIndex) return todos[sourceIndex].order || 0;

    if (destIndex === 0) {
        return ((todos[0]?.order || 0) - 1);
    }

    if (destIndex === todos.length - 1) {
        return ((todos[todos.length - 1]?.order || 0) + 1);
    }

    const prevOrder = todos[destIndex - 1]?.order || 0;
    const nextOrder = todos[destIndex]?.order || 0;
    return (prevOrder + nextOrder) / 2;
}

// Types
// ----------
type Todo = {
    id: string;
    text: string;
    done: boolean;
    createdAt: number;
    listId: string;
    order?: number;
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
        borderRadius: "20px",
        border: "var(--border-style)",
        width: "100%",
        padding: "20px 0",
    },
    listContainer: {
        borderRadius: "15px",
        border: "var(--border-style)",
        overflow: "hidden",
        minWidth: "300px",
        maxWidth: "300px",
        marginRight: "20px",
        backgroundColor: "white",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        display: "flex",
        flexDirection: "column",
    },
    listTitle: {
        padding: "10px",
        margin: "0",
        borderBottom: "var(--border-style)",
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
        cursor: "text",
        minHeight: "1em",
        outline: "none",
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
    addTodoButton: {
        fontSize: "18px",
        cursor: "pointer",
        backgroundColor: "#4CAF50",
        color: "white",
        border: "none",
        borderRadius: "50%",
        width: "24px",
        height: "24px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 0,
    },
    dropIndicator: {
        height: '2px',
        backgroundColor: '#4CAF50',
        transition: 'all 0.2s ease',
    },
};

export default App;
