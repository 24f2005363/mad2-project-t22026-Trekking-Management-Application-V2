export default {
    name: "ClientPanel",
    data() {
        return {
            clients: [],
            searchWord: ""
        }
    },
    created() {
        this.loadClients()
    },
    methods: {
        async loadClients() {
            try {
                const res = await fetch("/api/adm-clients/list")
                if (res.ok) this.clients = await res.json()
            } catch (err) { console.log("Clients load error") }
        },
        async searchClients() {
            if (!this.searchWord.trim()) { this.loadClients(); return }
            try {
                const res = await fetch("/api/adm-clients/search?word=" + encodeURIComponent(this.searchWord))
                if (res.ok) this.clients = await res.json()
            } catch (err) { console.log("Search error") }
        },
        async toggleClientBlock(client) {
            const endpoint = client.blacklisted ? "/api/adm-clients/unblock/" + client.user_id : "/api/adm-clients/block/" + client.user_id
            try {
                const res = await fetch(endpoint, { method: "POST" })
                if (res.ok) this.loadClients()
            } catch (err) { console.log("Toggle block error") }
        },
        async deleteClient(clientId) {
            if (!confirm("Remove this client?")) return
            try {
                const res = await fetch("/api/adm-clients/remove/" + clientId, { method: "DELETE" })
                if (res.ok) this.loadClients()
            } catch (err) { console.log("Delete error") }
        }
    },
    template: `
        <div class="card p-3 shadow-sm table-responsive">
            <h5>Registered Clients (Trekkers)</h5>
            <div class="input-group mb-2 mt-2">
                <input type="text" class="form-control form-control-sm" placeholder="Search by name or email" v-model="searchWord" @input="searchClients">
                <span class="input-group-text small" v-if="searchWord">Filtering...</span>
            </div>
            <table class="table table-hover mt-3 align-middle">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Mobile</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="c in clients" :key="c.user_id">
                        <td><strong>{{ c.name }}</strong></td>
                        <td>{{ c.email }}</td>
                        <td>{{ c.mobile || 'N/A' }}</td>
                        <td>
                            <span class="badge" :class="c.blacklisted ? 'bg-danger' : 'bg-success'">
                                {{ c.blacklisted ? 'Blacklisted' : 'Active' }}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm me-2" :class="c.blacklisted ? 'btn-outline-success' : 'btn-outline-danger'" @click="toggleClientBlock(c)">
                                {{ c.blacklisted ? 'Whitelist' : 'Blacklist' }}
                            </button>
                            <button class="btn btn-danger btn-sm" @click="deleteClient(c.user_id)">Remove</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `
}
