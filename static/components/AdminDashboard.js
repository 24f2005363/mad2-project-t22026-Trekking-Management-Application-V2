export default {
    name: "AdminDashboard",
    data() {
        return {
            activeTab: "overview",
            stats: {
                total_treks: 0,
                total_users: 0,
                total_staff: 0,
                total_bookings: 0
            },
            // Trek Route Management
            treks: [],
            newTrek: {
                title: "",
                place: "",
                level: "Easy",
                duration: "",
                max_slots: "",
                start_date: "",
                end_date: "",
                about: ""
            },
            trekMsg: "",
            trekErr: "",
            
            // Staff/Guide Management
            guides: [],
            newGuide: {
                name: "",
                email: "",
                mobile: "",
                password: "",
                exp_years: "",
                skills: "",
                info: ""
            },
            guideMsg: "",
            guideErr: "",

            // Clients Management
            clients: [],
            clientMsg: "",
            clientErr: "",

            // Bookings
            bookings: [],

            // Search fields
            searchTrekWord: "",
            searchGuideWord: "",
            searchClientWord: "",

            // Assign staff modal/overlay data
            selectedTrekId: null,
            selectedStaffId: ""
        }
    },
    created() {
        this.fetchStats()
        this.fetchTreks()
        this.fetchGuides()
        this.fetchClients()
        this.fetchBookings()
    },
    methods: {
        async fetchStats() {
            try {
                const res = await fetch("/api/admin-stats")
                if (res.ok) {
                    this.stats = await res.json()
                }
            } catch (err) {
                console.log("Error loading stats")
            }
        },
        async fetchTreks() {
            try {
                const res = await fetch("/api/adm-treks/list")
                if (res.ok) {
                    this.treks = await res.json()
                }
            } catch (err) {
                console.log("Error loading treks")
            }
        },
        async fetchGuides() {
            try {
                const res = await fetch("/api/adm-guides/list")
                if (res.ok) {
                    this.guides = await res.json()
                }
            } catch (err) {
                console.log("Error loading guides")
            }
        },
        async fetchClients() {
            try {
                const res = await fetch("/api/adm-clients/list")
                if (res.ok) {
                    this.clients = await res.json()
                }
            } catch (err) {
                console.log("Error loading clients")
            }
        },
        async fetchBookings() {
            try {
                const res = await fetch("/api/adm-bookings/all")
                if (res.ok) {
                    this.bookings = await res.json()
                }
            } catch (err) {
                console.log("Error loading bookings")
            }
        },
        async searchTreks() {
            if (!this.searchTrekWord.trim()) {
                this.fetchTreks()
                return
            }
            try {
                const res = await fetch("/api/adm-treks/search?word=" + encodeURIComponent(this.searchTrekWord))
                if (res.ok) {
                    this.treks = await res.json()
                }
            } catch (err) {
                console.log("Search error")
            }
        },
        async searchGuides() {
            if (!this.searchGuideWord.trim()) {
                this.fetchGuides()
                return
            }
            try {
                const res = await fetch("/api/adm-guides/search?word=" + encodeURIComponent(this.searchGuideWord))
                if (res.ok) {
                    this.guides = await res.json()
                }
            } catch (err) {
                console.log("Search error")
            }
        },
        async searchClients() {
            if (!this.searchClientWord.trim()) {
                this.fetchClients()
                return
            }
            try {
                const res = await fetch("/api/adm-clients/search?word=" + encodeURIComponent(this.searchClientWord))
                if (res.ok) {
                    this.clients = await res.json()
                }
            } catch (err) {
                console.log("Search error")
            }
        },
        async handleCreateTrek() {
            this.trekMsg = ""
            this.trekErr = ""
            try {
                const res = await fetch("/api/adm-treks/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.newTrek)
                })
                const result = await res.json()
                if (res.ok) {
                    this.trekMsg = "Trek route created successfully!"
                    this.newTrek = { title: "", place: "", level: "Easy", duration: "", max_slots: "", start_date: "", end_date: "", about: "" }
                    this.fetchTreks()
                    this.fetchStats()
                } else {
                    this.trekErr = result.error || "Failed to create trek"
                }
            } catch (err) {
                this.trekErr = "Server communication failure"
            }
        },
        async updateTrekStatus(trekId, newStatus) {
            try {
                const res = await fetch(`/api/adm-treks/update-state/${trekId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus })
                })
                if (res.ok) {
                    this.fetchTreks()
                }
            } catch (err) {
                console.log("Error updating trek status")
            }
        },
        async deleteTrek(trekId) {
            if (!confirm("Are you sure you want to delete this trek?")) return
            try {
                const res = await fetch(`/api/adm-treks/remove/${trekId}`, {
                    method: "DELETE"
                })
                if (res.ok) {
                    this.fetchTreks()
                    this.fetchStats()
                }
            } catch (err) {
                console.log("Error deleting trek")
            }
        },
        async handleCreateGuide() {
            this.guideMsg = ""
            this.guideErr = ""
            try {
                const res = await fetch("/api/adm-guides/new", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.newGuide)
                })
                const result = await res.json()
                if (res.ok) {
                    this.guideMsg = "Staff profile added successfully!"
                    this.newGuide = { name: "", email: "", mobile: "", password: "", exp_years: "", skills: "", info: "" }
                    this.fetchGuides()
                    this.fetchStats()
                } else {
                    this.guideErr = result.error || "Failed to create staff"
                }
            } catch (err) {
                this.guideErr = "Server communication failure"
            }
        },
        async toggleGuideBlock(guide) {
            const endpoint = guide.blacklisted 
                ? `/api/adm-guides/unblock/${guide.guide_profile_id}` 
                : `/api/adm-guides/block/${guide.guide_profile_id}`
            try {
                const res = await fetch(endpoint, { method: "POST" })
                if (res.ok) {
                    this.fetchGuides()
                }
            } catch (err) {
                console.log("Error toggling guide block state")
            }
        },
        async toggleClientBlock(client) {
            const endpoint = client.blacklisted 
                ? `/api/adm-clients/unblock/${client.user_id}` 
                : `/api/adm-clients/block/${client.user_id}`
            try {
                const res = await fetch(endpoint, { method: "POST" })
                if (res.ok) {
                    this.fetchClients()
                }
            } catch (err) {
                console.log("Error toggling client block state")
            }
        },
        async deleteClient(clientId) {
            if (!confirm("Are you sure you want to remove this client?")) return
            try {
                const res = await fetch(`/api/adm-clients/remove/${clientId}`, {
                    method: "DELETE"
                })
                if (res.ok) {
                    this.fetchClients()
                    this.fetchStats()
                }
            } catch (err) {
                console.log("Error deleting client")
            }
        },
        openAssignModal(trekId) {
            this.selectedTrekId = trekId
            this.selectedStaffId = ""
        },
        async assignStaffToTrek() {
            if (!this.selectedStaffId) return
            try {
                const res = await fetch(`/api/adm-guides/assign-route/${this.selectedStaffId}/${this.selectedTrekId}`, {
                    method: "POST"
                })
                if (res.ok) {
                    this.selectedTrekId = null
                    this.fetchTreks()
                } else {
                    const result = await res.json()
                    alert(result.error || "Failed to assign staff")
                }
            } catch (err) {
                alert("Connection error")
            }
        }
    },
    template: `
        <div>
            <div class="row mb-4">
                <div class="col-md-12">
                    <h2 class="border-bottom pb-2">Admin Administration Panel</h2>
                </div>
            </div>

            <!-- Tab Buttons -->
            <ul class="nav nav-tabs mb-4">
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'overview'}" @click="activeTab = 'overview'">Overview</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'treks'}" @click="activeTab = 'treks'">Trek Routes</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'staff'}" @click="activeTab = 'staff'">Guides & Staff</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'clients'}" @click="activeTab = 'clients'">Clients</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'bookings'}" @click="activeTab = 'bookings'">Bookings</button>
                </li>
            </ul>

            <!-- Overview Content -->
            <div v-if="activeTab === 'overview'">
                <div class="row">
                    <div class="col-md-3">
                        <div class="card bg-primary text-white p-3 mb-3 shadow-sm">
                            <h6>Total Treks</h6>
                            <h3>{{ stats.total_treks }}</h3>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-success text-white p-3 mb-3 shadow-sm">
                            <h6>Guides / Staff</h6>
                            <h3>{{ stats.total_staff }}</h3>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-info text-white p-3 mb-3 shadow-sm">
                            <h6>Registered Clients</h6>
                            <h3>{{ stats.total_users }}</h3>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-warning text-dark p-3 mb-3 shadow-sm">
                            <h6>Total Bookings</h6>
                            <h3>{{ stats.total_bookings }}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Trek Routes Content -->
            <div v-if="activeTab === 'treks'">
                <div class="row">
                    <!-- Create Trek -->
                    <div class="col-md-4">
                        <div class="card p-3 shadow-sm mb-4">
                            <h5>Create Trek Route</h5>
                            <div class="alert alert-success mt-2" v-if="trekMsg">{{ trekMsg }}</div>
                            <div class="alert alert-danger mt-2" v-if="trekErr">{{ trekErr }}</div>
                            <div class="mb-2 mt-2">
                                <label class="form-label small">Trek Title</label>
                                <input type="text" class="form-control form-control-sm" v-model="newTrek.title" placeholder="Himalayan Valley">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Place / Location</label>
                                <input type="text" class="form-control form-control-sm" v-model="newTrek.place" placeholder="Uttarakhand">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Difficulty Level</label>
                                <select class="form-select form-select-sm" v-model="newTrek.level">
                                    <option>Easy</option>
                                    <option>Moderate</option>
                                    <option>Hard</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Duration (Days)</label>
                                <input type="number" class="form-control form-control-sm" v-model="newTrek.duration">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Max Slots</label>
                                <input type="number" class="form-control form-control-sm" v-model="newTrek.max_slots">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Start Date</label>
                                <input type="date" class="form-control form-control-sm" v-model="newTrek.start_date">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">End Date</label>
                                <input type="date" class="form-control form-control-sm" v-model="newTrek.end_date">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">About Description</label>
                                <textarea class="form-control form-control-sm" v-model="newTrek.about" rows="2"></textarea>
                            </div>
                            <button class="btn btn-primary btn-sm w-100 mt-2" @click="handleCreateTrek">Add Trek Route</button>
                        </div>
                    </div>

                    <!-- Trek Routes List -->
                    <div class="col-md-8">
                        <div class="card p-3 shadow-sm table-responsive">
                            <h5>Trek Routes List</h5>
                            <div class="input-group mb-2 mt-2">
                                <input type="text" class="form-control form-control-sm" placeholder="Search by name or location" v-model="searchTrekWord" @input="searchTreks">
                                <span class="input-group-text small" v-if="searchTrekWord">Filtering...</span>
                            </div>
                            <table class="table table-hover mt-3 align-middle">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Location</th>
                                        <th>Slots</th>
                                        <th>Staff / Guide</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="t in treks" :key="t.id">
                                        <td><strong>{{ t.title }}</strong><br><span class="text-muted small">{{ t.start_date }} to {{ t.end_date }}</span></td>
                                        <td>{{ t.place }} <span class="badge bg-secondary">{{ t.level }}</span></td>
                                        <td>{{ t.left_slots }} / {{ t.max_slots }}</td>
                                        <td>
                                            <span v-if="t.guide_name" class="badge bg-info text-dark">{{ t.guide_name }}</span>
                                            <span v-else class="text-danger small">Unassigned</span>
                                            <button class="btn btn-link btn-sm d-block p-0" @click="openAssignModal(t.id)">Assign</button>
                                        </td>
                                        <td>
                                            <select class="form-select form-select-sm" :value="t.status" @change="updateTrekStatus(t.id, $event.target.value)">
                                                <option>Pending</option>
                                                <option>Open</option>
                                                <option>Closed</option>
                                                <option>Cancelled</option>
                                                <option>Ongoing</option>
                                                <option>Completed</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button class="btn btn-danger btn-sm" @click="deleteTrek(t.id)">Delete</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Simple Overlay Modal for Guide Assignment -->
                <div v-if="selectedTrekId !== null" class="modal d-block bg-dark bg-opacity-50" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Assign Guide to Trek</h5>
                                <button type="button" class="btn-close" @click="selectedTrekId = null"></button>
                            </div>
                            <div class="modal-body">
                                <label class="form-label">Select Active Staff</label>
                                <select class="form-select" v-model="selectedStaffId">
                                    <option value="" disabled>-- Choose staff --</option>
                                    <option v-for="g in guides" :key="g.guide_profile_id" :value="g.guide_profile_id" :disabled="g.state !== 'Active'">
                                        {{ g.name }} ({{ g.state }})
                                    </option>
                                </select>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" @click="selectedTrekId = null">Close</button>
                                <button type="button" class="btn btn-primary" @click="assignStaffToTrek">Confirm Assignment</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Guides & Staff Content -->
            <div v-if="activeTab === 'staff'">
                <div class="row">
                    <!-- Create Staff -->
                    <div class="col-md-4">
                        <div class="card p-3 shadow-sm mb-4">
                            <h5>Create Staff Profile</h5>
                            <div class="alert alert-success mt-2" v-if="guideMsg">{{ guideMsg }}</div>
                            <div class="alert alert-danger mt-2" v-if="guideErr">{{ guideErr }}</div>
                            <div class="mb-2 mt-2">
                                <label class="form-label small">Name</label>
                                <input type="text" class="form-control form-control-sm" v-model="newGuide.name">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Email</label>
                                <input type="email" class="form-control form-control-sm" v-model="newGuide.email">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Mobile</label>
                                <input type="text" class="form-control form-control-sm" v-model="newGuide.mobile">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Password</label>
                                <input type="password" class="form-control form-control-sm" v-model="newGuide.password">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Experience (Years)</label>
                                <input type="text" class="form-control form-control-sm" v-model="newGuide.exp_years">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Skills / Specialization</label>
                                <input type="text" class="form-control form-control-sm" v-model="newGuide.skills">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Additional Information</label>
                                <textarea class="form-control form-control-sm" v-model="newGuide.info" rows="2"></textarea>
                            </div>
                            <button class="btn btn-success btn-sm w-100 mt-2" @click="handleCreateGuide">Add Staff Member</button>
                        </div>
                    </div>

                    <!-- Staff List -->
                    <div class="col-md-8">
                        <div class="card p-3 shadow-sm table-responsive">
                            <h5>Staff List</h5>
                            <div class="input-group mb-2 mt-2">
                                <input type="text" class="form-control form-control-sm" placeholder="Search by name or email" v-model="searchGuideWord" @input="searchGuides">
                                <span class="input-group-text small" v-if="searchGuideWord">Filtering...</span>
                            </div>
                            <table class="table table-hover mt-3 align-middle">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Skills</th>
                                        <th>Experience</th>
                                        <th>Status</th>
                                        <th>Block State</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="g in guides" :key="g.guide_profile_id">
                                        <td><strong>{{ g.name }}</strong></td>
                                        <td>{{ g.email }}<br><span class="text-muted small">{{ g.info }}</span></td>
                                        <td>{{ g.skills }}</td>
                                        <td>{{ g.exp_years }} years</td>
                                        <td>
                                            <span class="badge" :class="g.state === 'Active' ? 'bg-success' : 'bg-secondary'">{{ g.state }}</span>
                                        </td>
                                        <td>
                                            <button class="btn btn-sm" :class="g.blacklisted ? 'btn-outline-success' : 'btn-outline-warning'" @click="toggleGuideBlock(g)">
                                                {{ g.blacklisted ? 'Reactivate' : 'Deactivate / Block' }}
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Clients Content -->
            <div v-if="activeTab === 'clients'">
                <div class="card p-3 shadow-sm table-responsive">
                    <h5>Registered Clients (Trekkers)</h5>
                    <div class="input-group mb-2 mt-2">
                        <input type="text" class="form-control form-control-sm" placeholder="Search by name or email" v-model="searchClientWord" @input="searchClients">
                        <span class="input-group-text small" v-if="searchClientWord">Filtering...</span>
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
            </div>

            <!-- Bookings Content -->
            <div v-if="activeTab === 'bookings'">
                <div class="card p-3 shadow-sm table-responsive">
                    <h5>All Bookings List</h5>
                    <table class="table table-hover mt-3 align-middle">
                        <thead>
                            <tr>
                                <th>Trek Route</th>
                                <th>Client Name</th>
                                <th>Seats Booked</th>
                                <th>Booking Time</th>
                                <th>Status</th>
                                <th>Payment</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="b in bookings" :key="b.id">
                                <td><strong>{{ b.trek_title }}</strong></td>
                                <td>{{ b.client_name }}</td>
                                <td>{{ b.qty }}</td>
                                <td>{{ b.book_time }}</td>
                                <td>
                                    <span class="badge" :class="b.status === 'Booked' ? 'bg-success' : 'bg-danger'">{{ b.status }}</span>
                                </td>
                                <td>
                                    <span class="badge" :class="b.pay_status === 'Paid' ? 'bg-success' : 'bg-warning text-dark'">{{ b.pay_status }}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `
}
