#!/usr/bin/env python3
"""
Task Manager - CLI task tracker
Get Claude to:
  - Fix the bugs
  - Add a priority system
  - Add due dates
  - Save tasks to a file
  - Add color to the output
"""

from datetime import datetime

class Task:
    def __init__(self, title, description=""):
        self.id = None
        self.title = title
        self.description = description
        self.done = False
        self.created_at = datetime.now()

    def complete(self):
        self.done = True

    def __str__(self):
        status = "x" if self.done else " "
        return f"[{self.id}] [{status}] {self.title}"


class TaskManager:
    def __init__(self):
        self.tasks = []
        self._next_id = 1

    def add_task(self, title, description=""):
        task = Task(title, description)
        task.id = self._next_id
        self._next_id += 1
        self.tasks.append(task)
        print(f"Added task: '{title}'")
        return task

    def complete_task(self, task_id):
        for task in self.tasks:
            if task.id == task_id:
                task.complete()
                print(f"Completed: '{task.title}'")
                return
        print(f"Task {task_id} not found.")

    def delete_task(self, task_id):
        for i, task in enumerate(self.tasks):
            if task.id == task_id:
                removed = self.tasks.pop(i)
                print(f"Deleted: '{removed.title}'")
                return
        print(f"Task {task_id} not found.")

    def list_tasks(self, show_done=True):
        if not self.tasks:
            print("No tasks yet! Add one with 'add'.")
            return

        pending = [t for t in self.tasks if not t.done]
        done = [t for t in self.tasks if t.done]

        print("\n=== Pending Tasks ===")
        if pending:
            for task in pending:
                print(f"  {task}")
                if task.description:
                    print(f"     {task.description}")
        else:
            print("  All done!")

        if show_done and done:
            print("\n=== Completed Tasks ===")
            for task in done:
                print(f"  {task}")

        print(f"\nTotal: {len(self.tasks)} tasks, {len(done)} completed")

    def get_stats(self):
        total = len(self.tasks)
        done = sum(1 for t in self.tasks if t.done)
        percent = (done / total) * 100 if total else 0
        print(f"Stats: {done}/{total} done ({percent:.0f}%)")


def print_help():
    print("""
Commands:
  add <title>              Add a new task
  add <title> | <desc>     Add task with description
  done <id>                Mark task complete
  del <id>                 Delete a task
  list                     List all tasks
  stats                    Show completion stats
  help                     Show this help
  quit                     Exit
""")


def main():
    manager = TaskManager()
    print("Task Manager - Type 'help' for commands\n")

    # Starter tasks
    manager.add_task("Buy groceries", "Milk, eggs, bread")
    manager.add_task("Read a book")
    manager.add_task("Go for a walk")
    manager.add_task("Write some code", "Work on a cool Python project")

    while True:
        try:
            raw = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not raw:
            continue

        parts = raw.split(" ", 1)
        cmd = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        if cmd in ("quit", "exit"):
            print("Goodbye!")
            break
        elif cmd == "help":
            print_help()
        elif cmd == "list":
            manager.list_tasks()
        elif cmd == "add":
            if not args:
                print("Usage: add <title> [| description]")
            elif "|" in args:
                title, desc = args.split("|", 1)
                manager.add_task(title.strip(), desc.strip())
            else:
                manager.add_task(args)
        elif cmd == "done":
            if not args.isdigit():
                print("Usage: done <id>")
            else:
                manager.complete_task(int(args))
        elif cmd == "del":
            if not args.isdigit():
                print("Usage: del <id>")
            else:
                manager.delete_task(int(args))
        elif cmd == "stats":
            manager.get_stats()
        else:
            print(f"Unknown command: '{cmd}'. Type 'help' for commands.")


if __name__ == "__main__":
    main()
