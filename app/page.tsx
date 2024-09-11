"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
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
    const [, forceUpdate] = useState({});

    if (isLoading) {
        return <div>Fetching data...</div>;
    }
    if (error) {
        return <div>Error fetching data: {error.message}</div>;
    }

    const { todos, lists } = data;

    const onListDragStart = () => {
        forceUpdate({});
    };

    const onListDragEnd = (source: TodoList, destination: TodoList, destinationIndex: number) => {
        const sortedLists = [...lists].sort((a, b) => (a.order || 0) - (b.order || 0));
        let newOrder;
        if (destinationIndex === 0) {
            newOrder = (sortedLists[0]?.order || 0) - 1;
        } else if (destinationIndex >= sortedLists.length) {
            newOrder = (sortedLists[sortedLists.length - 1]?.order || 0) + 1;
        } else {
            const prevOrder = sortedLists[destinationIndex - 1].order || 0;
            const nextOrder = sortedLists[destinationIndex].order || 0;
            newOrder = (prevOrder + nextOrder) / 2;
        }

        db.transact(tx.lists[source.id].update({ order: newOrder }));
    };

    return (
        <div className="container" style={styles.container}>
            <button onClick={addList} style={styles.addListButton}>
                Add List
            </button>
            <div className="listsContainer" style={styles.listsContainer}>
                {lists.sort((a, b) => (a.order || 0) - (b.order || 0)).map((list, index) => (
                    <TodoListComponent
                        key={list.id}
                        list={list}
                        todos={todos.filter((todo) => todo.listId === list.id)}
                        onListDragStart={onListDragStart}
                        onListDragEnd={onListDragEnd}
                        index={index}
                    />
                ))}
            </div>
        </div>
    );
}

function TodoListComponent({ 
    list, 
    todos, 
    onListDragStart, 
    onListDragEnd, 
    index 
}: { 
    list: TodoList; 
    todos: Todo[]; 
    onListDragStart: () => void; 
    onListDragEnd: (source: TodoList, destination: TodoList, destinationIndex: number) => void; 
    index: number;
}) {
    const listRef = useRef<HTMLDivElement>(null);

    const onDragStart = () => {
        onListDragStart();
    };

    const onDragEnd = (source: Todo, destination: Todo | TodoList, destinationIndex: number) => {
        console.log('Source:', JSON.stringify(source, null, 2));
        console.log('Destination:', JSON.stringify(destination, null, 2));
        console.log('Destination Index:', destinationIndex);

        if (!source || !source.id) {
            console.error('Invalid source object:', source);
            return;
        }

        let transactionSteps;
        if ('name' in destination) {
            // Dropping onto a different list
            const destinationTodos = todos.filter(t => t.listId === destination.id).sort((a, b) => (a.order || 0) - (b.order || 0));
            let newOrder;
            if (destinationIndex === 0) {
                newOrder = ((destinationTodos[0]?.order || 0) - 1);
            } else if (destinationIndex >= destinationTodos.length) {
                newOrder = ((destinationTodos[destinationTodos.length - 1]?.order || 0) + 1);
            } else {
                const prevOrder = destinationTodos[destinationIndex - 1].order || 0;
                const nextOrder = destinationTodos[destinationIndex].order || 0;
                newOrder = (prevOrder + nextOrder) / 2;
            }
            transactionSteps = [
                tx.todos[source.id].update({ 
                    listId: destination.id,
                    order: newOrder,
                })
            ];
        } else {
            // Reordering within the same list
            const sortedTodos = todos.filter(t => t.listId === source.listId).sort((a, b) => (a.order || 0) - (b.order || 0));
            let newOrder;
            if (destinationIndex === 0) {
                newOrder = ((sortedTodos[0]?.order || 0) - 1);
            } else if (destinationIndex >= sortedTodos.length) {
                newOrder = ((sortedTodos[sortedTodos.length - 1]?.order || 0) + 1);
            } else {
                const prevOrder = sortedTodos[destinationIndex - 1].order || 0;
                const nextOrder = sortedTodos[destinationIndex].order || 0;
                newOrder = (prevOrder + nextOrder) / 2;
            }
            
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

    useEffect(() => {
        if (!listRef.current) return;

        const cleanup = combine(
            draggable({
                element: listRef.current,
                getInitialData: () => list,
            }),
            dropTargetForElements({
                element: listRef.current,
                getData: () => ({ ...list, index }),
                onDrag: () => {
                    if (listRef.current) {
                        listRef.current.style.opacity = '0.5';
                    }
                },
                onDragLeave: () => {
                    if (listRef.current) {
                        listRef.current.style.opacity = '1';
                    }
                },
                onDrop: (args) => {
                    if (listRef.current) {
                        listRef.current.style.opacity = '1';
                    }
                    if (args.source.data) {
                        const sourceList = args.source.data as TodoList;
                        onListDragEnd(sourceList, list, index);
                    }
                },
            }),
            monitorForElements({
                onDragStart,
                onDrop: () => {
                    onDragStart();
                },
            })
        );

        return cleanup;
    }, [list, index, onListDragStart, onListDragEnd]);

    return (
        <div ref={listRef} className="listContainer" style={styles.listContainer}>
            <EditableTitle list={list} />
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
                order: Date.now(), // Use timestamp as initial order
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
function TodoList({ todos, listId, onDragStart, onDragEnd }: { todos: Todo[]; listId: string; onDragStart: () => void; onDragEnd: (source: Todo, destination: Todo | TodoList, destinationIndex: number) => void }) {
    const sortedTodos = useMemo(() => [...todos].sort((a, b) => (a.order || 0) - (b.order || 0)), [todos]);
    const listRef = useRef<HTMLDivElement>(null);
    const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);

    useEffect(() => {
        if (!listRef.current) return;

        const cleanup = combine(
            dropTargetForElements({
                element: listRef.current,
                getData: () => ({ id: listId, name: 'List' }),
                canDrop: (args) => {
                    return args.source.data && 'listId' in args.source.data;
                },
                onDrag: (args) => {
                    if (args.source.element) {
                        args.source.element.style.opacity = '0.5';
                    }
                    
                    // Update drop indicator position
                    if (listRef.current) {
                        const listRect = listRef.current.getBoundingClientRect();
                        const y = args.location.current.input.clientY;
                        const todoItems = Array.from(listRef.current.children).filter(child => child.classList.contains('todo-item'));
                        let index = todoItems.findIndex(item => {
                            const rect = item.getBoundingClientRect();
                            return y < rect.top + rect.height / 2;
                        });
                        if (index === -1) index = todoItems.length;
                        setDropIndicatorIndex(index);
                    }
                },
                onDragLeave: (args) => {
                    if (args.source.element) {
                        args.source.element.style.opacity = '1';
                    }
                    setDropIndicatorIndex(null);
                },
                onDrop: (args) => {
                    if (args.source.element) {
                        args.source.element.style.opacity = '1';
                    }
                    if (args.source.data) {
                        const sourceTodo = args.source.data as Todo;
                        const destinationIndex = dropIndicatorIndex !== null ? dropIndicatorIndex : sortedTodos.length;
                        if (sourceTodo.listId !== listId) {
                            // Dropping onto a different list
                            onDragEnd(sourceTodo, { id: listId, name: 'List', createdAt: Date.now() }, destinationIndex);
                        } else {
                            // Reordering within the same list
                            const destinationTodo = sortedTodos[destinationIndex] || { id: 'end', listId, order: Number.MAX_SAFE_INTEGER, text: '', done: false, createdAt: Date.now() };
                            onDragEnd(sourceTodo, destinationTodo, destinationIndex);
                        }
                    } else {
                        console.error('Drop event occurred but source data is missing');
                    }
                    setDropIndicatorIndex(null);
                },
            }),
            monitorForElements({
                onDragStart,
                onDrop: () => {
                    onDragStart();
                    setDropIndicatorIndex(null);
                },
            })
        );

        return cleanup;
    }, [listId, onDragEnd, onDragStart, sortedTodos, dropIndicatorIndex]);

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

function TodoItem({ todo, listId, todos, onDragEnd }: { todo: Todo; listId: string; todos: Todo[]; onDragEnd: (source: Todo, destination: Todo | TodoList, destinationIndex: number) => void }) {
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
                    if (args.source.data) {
                        const sourceTodo = args.source.data as Todo;
                        const destinationIndex = todos.findIndex(t => t.id === todo.id);
                        onDragEnd(sourceTodo, todo, destinationIndex);
                    } else {
                        console.error('Drop event occurred in TodoItem but source data is missing');
                    }
                },
            })
        );

        return cleanup;
    }, [todo, onDragEnd, todos]);

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
        <div ref={itemRef} className="item todo-item" style={styles.todo}>
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
    order?: number;
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
        padding: "20px",
    },
    listContainer: {
        borderRadius: "8px",
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
        outline: "none", // Remove the focus outline
        minHeight: "1em", // Ensure a minimum height
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

// Add this new function near the other data manipulation functions
function updateListName(list: TodoList, newName: string) {
    db.transact(tx.lists[list.id].update({ 
        name: newName,
    }));
}

// Add this new component
function EditableTitle({ list }: { list: TodoList }) {
    const [text, setText] = useState(list.name);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setText(list.name);
    }, [list.name]);

    const handleBlur = () => {
        setIsEditing(false);
        if (text.trim() === "") {
            setText(list.name); // Reset to original name if empty
        } else if (text !== list.name) {
            updateListName(list, text);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            inputRef.current?.blur();
        }
    };

    const handleDoubleClick = () => {
        setIsEditing(true);
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(0, text.length);
        }, 0);
    };

    return (
        <div style={styles.listTitle} onDoubleClick={handleDoubleClick}>
            {isEditing ? (
                <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    style={{
                        ...styles.listTitle,
                        border: 'none',
                        background: 'transparent',
                        width: '100%',
                    }}
                />
            ) : (
                <span>{text}</span>
            )}
        </div>
    );
}

export default App;
