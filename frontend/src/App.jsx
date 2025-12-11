import { useEffect, useState } from "react";

// change to your backend URL
const API_URL = "https://pika-1-dhxw.onrender.com";

function App() {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/users`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError("Could not load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Create user with optional file
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Name is required");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", name);
      if (file) formData.append("file", file);

      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
        body: formData, // multipart/form-data
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to create user");
        return;
      }

      setUsers((prev) => [...prev, data]);
      setName("");
      setFile(null);
      // clear file input visually by resetting value (if you have ref to input)
      // optional: fetchUsers() to refresh
    } catch (err) {
      console.error(err);
      alert("Error creating user");
    }
  };

  // Start editing
  const startEdit = (user) => {
    setEditId(user._id);
    setEditName(user.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  // Update user name
  const handleUpdate = async (id) => {
    if (!editName.trim()) {
      alert("Name is required");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to update user");
        return;
      }

      setUsers((prev) => prev.map((u) => (u._id === id ? data : u)));
      cancelEdit();
    } catch (err) {
      console.error(err);
      alert("Error updating user");
    }
  };

  // Delete user (will also attempt to delete their file on the server)
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`${API_URL}/users/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to delete user");
        return;
      }

      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (err) {
      console.error(err);
      alert("Error deleting user");
    }
  };

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "40px auto",
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 8,
        fontFamily: "inherit",
      }}
    >
      <h1 style={{ textAlign: "center" }}>Users CRUD (Express + React)</h1>

      <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
        <h2>Add User</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Enter name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button type="submit" style={{ padding: "8px 16px" }}>
            Add
          </button>
        </div>
      </form>

      <hr />

      <h2>Users</h2>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!loading && users.length === 0 && <p>No users found.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {users.map((user, index) => (
          <li
            key={user._id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {editId === user._id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ flex: 1, padding: 6 }}
                />
                <button onClick={() => handleUpdate(user._id)}>Save</button>
                <button onClick={cancelEdit}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>
                  #{index + 1} – <strong>{user.name}</strong>
                  {user.documentFilename ? (
                    <span style={{ marginLeft: 10 }}>
                      • {user.documentFilename}{" "}
                      <a
                        href={`${API_URL}/files/${user.documentField}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                    </span>
                  ) : null}
                </span>
                <button onClick={() => startEdit(user)}>Edit</button>
                <button onClick={() => handleDelete(user._id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
