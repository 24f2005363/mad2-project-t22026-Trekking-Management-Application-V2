export default {
    name: "StaffDashboard",
    data() {
        return {
            viewMode: "home",
            summary: {
                assigned_count: 0,
                participant_count: 0,
                active_treks: 0,
                staff_name: ""
            },
            routeList: [],
            selectedRoute: null,
            statusMsg: "",
            statusError: "",
            newSlotValue: "",
            slotMsg: ""
        }
    },
    created() {
        this.loadSummary()
        this.loadRoutes()
    },
    methods: {
        async loadSummary() {
            try {
                let res = await fetch("/api/staff-panel/summary")
                if (res.ok) {
                    this.summary = await res.json()
                }
            } catch (err) {
                console.log("Failed to load summary")
            }
        },
        async loadRoutes() {
            try {
                let res = await fetch("/api/staff-panel/routes")
                if (res.ok) {
                    this.routeList = await res.json()
                }
            } catch (err) {
                console.log("Failed to load routes")
            }
        },
        async openRouteDetail(routeId) {
            this.statusMsg = ""
            this.statusError = ""
            this.slotMsg = ""
            this.newSlotValue = ""
            try {
                let res = await fetch("/api/staff-panel/routes/" + routeId)
                if (res.ok) {
                    this.selectedRoute = await res.json()
                    this.viewMode = "detail"
                } else {
                    let errData = await res.json()
                    alert(errData.error || "Cannot open trek")
                }
            } catch (err) {
                alert("Connection error")
            }
        },
        goBack() {
            this.viewMode = "home"
            this.selectedRoute = null
            this.loadSummary()
            this.loadRoutes()
        },
        async updateRouteStatus(newStatus) {
            this.statusMsg = ""
            this.statusError = ""
            try {
                let res = await fetch("/api/staff-panel/routes/" + this.selectedRoute.id + "/change-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus })
                })
                let result = await res.json()
                if (res.ok) {
                    this.statusMsg = "Status changed to " + newStatus
                    this.selectedRoute.status = newStatus
                } else {
                    this.statusError = result.error || "Update failed"
                }
            } catch (err) {
                this.statusError = "Server error"
            }
        },
        async updateSlots() {
            this.slotMsg = ""
            if (!this.newSlotValue) {
                this.slotMsg = "Enter a number"
                return
            }
            try {
                let res = await fetch("/api/staff-panel/routes/" + this.selectedRoute.id + "/adjust-slots", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slots: this.newSlotValue })
                })
                let result = await res.json()
                if (res.ok) {
                    this.slotMsg = "Slots set to " + result.left_slots
                    this.selectedRoute.left_slots = result.left_slots
                } else {
                    this.slotMsg = result.error || "Update failed"
                }
            } catch (err) {
                this.slotMsg = "Server error"
            }
        },
        async markTrekDone() {
            if (!confirm("Mark this trek as completed?")) return
            this.statusMsg = ""
            this.statusError = ""
            try {
                let res = await fetch("/api/staff-panel/routes/" + this.selectedRoute.id + "/mark-done", {
                    method: "POST"
                })
                let result = await res.json()
                if (res.ok) {
                    this.statusMsg = result.message + " (" + result.bookings_updated + " bookings)"
                    this.selectedRoute.status = "Completed"
                } else {
                    this.statusError = result.error || "Failed"
                }
            } catch (err) {
                this.statusError = "Server error"
            }
        },
        getStatusBadge(st) {
            if (st == "Open") return "bg-success"
            if (st == "Closed") return "bg-danger"
            if (st == "Ongoing") return "bg-warning text-dark"
            if (st == "Completed") return "bg-primary"
            return "bg-secondary"
        }
    },
    template: `
        <div>
            <!-- Home view -->
            <div v-if="viewMode == 'home'">
                <div class="row mb-3">
                    <div class="col-md-12">
                        <h2 class="border-bottom pb-2">Staff Panel</h2>
                        <p class="text-muted">Welcome, {{ summary.staff_name }}</p>
                    </div>
                </div>
                <div class="row mb-4">
                    <div class="col-md-4">
                        <div class="card bg-success text-white p-3 shadow-sm">
                            <h6>Assigned Treks</h6>
                            <h3>{{ summary.assigned_count }}</h3>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card bg-info text-white p-3 shadow-sm">
                            <h6>Total Participants</h6>
                            <h3>{{ summary.participant_count }}</h3>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card bg-warning text-dark p-3 shadow-sm">
                            <h6>Active / Ongoing</h6>
                            <h3>{{ summary.active_treks }}</h3>
                        </div>
                    </div>
                </div>
                <div class="card p-3 shadow-sm">
                    <h5>My Assigned Routes</h5>
                    <div v-if="routeList.length == 0" class="text-muted mt-3">No treks assigned yet.</div>
                    <div v-else class="table-responsive mt-3">
                        <table class="table table-hover align-middle">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Location</th>
                                    <th>Slots Left</th>
                                    <th>Registered</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="r in routeList" :key="r.id">
                                    <td><strong>{{ r.title }}</strong><br><span class="small text-muted">{{ r.start_date }} to {{ r.end_date }}</span></td>
                                    <td>{{ r.place }} <span class="badge bg-secondary">{{ r.level }}</span></td>
                                    <td>{{ r.left_slots }} / {{ r.max_slots }}</td>
                                    <td>{{ r.registered }}</td>
                                    <td><span class="badge" :class="getStatusBadge(r.status)">{{ r.status }}</span></td>
                                    <td><button class="btn btn-outline-primary btn-sm" @click="openRouteDetail(r.id)">Manage</button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Detail view -->
            <div v-if="viewMode == 'detail' && selectedRoute">
                <button class="btn btn-outline-secondary btn-sm mb-3" @click="goBack">&larr; Back to Dashboard</button>
                <div class="row">
                    <div class="col-md-7">
                        <div class="card p-3 shadow-sm mb-3">
                            <h4>{{ selectedRoute.title }}</h4>
                            <p class="text-muted">{{ selectedRoute.place }} | {{ selectedRoute.level }} | {{ selectedRoute.duration }} days</p>
                            <p><strong>Dates:</strong> {{ selectedRoute.start_date }} to {{ selectedRoute.end_date }}</p>
                            <p><strong>About:</strong> {{ selectedRoute.about || 'No description' }}</p>
                            <p><strong>Status:</strong> <span class="badge" :class="getStatusBadge(selectedRoute.status)">{{ selectedRoute.status }}</span></p>

                            <hr>
                            <h5>Manage Trek</h5>
                            <div v-if="statusMsg" class="alert alert-success small">{{ statusMsg }}</div>
                            <div v-if="statusError" class="alert alert-danger small">{{ statusError }}</div>

                            <div class="mb-2">
                                <label class="form-label small">Change Status</label>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-success btn-sm" @click="updateRouteStatus('Open')" :disabled="selectedRoute.status == 'Open'">Open</button>
                                    <button class="btn btn-danger btn-sm" @click="updateRouteStatus('Closed')" :disabled="selectedRoute.status == 'Closed'">Closed</button>
                                    <button class="btn btn-warning btn-sm" @click="updateRouteStatus('Ongoing')" :disabled="selectedRoute.status == 'Ongoing'">Ongoing</button>
                                </div>
                            </div>

                            <div class="mb-2 mt-3">
                                <label class="form-label small">Available Slots (max {{ selectedRoute.max_slots }})</label>
                                <div class="input-group input-group-sm" style="max-width: 250px">
                                    <input type="number" class="form-control" v-model="newSlotValue" :placeholder="selectedRoute.left_slots">
                                    <button class="btn btn-primary" @click="updateSlots">Update</button>
                                </div>
                                <span v-if="slotMsg" class="small text-info">{{ slotMsg }}</span>
                            </div>

                            <div class="mt-3">
                                <button class="btn btn-primary btn-sm" @click="markTrekDone" :disabled="selectedRoute.status == 'Completed'">
                                    Mark as Completed
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <div class="card p-3 shadow-sm mb-3">
                            <h5>Participants ({{ selectedRoute.participants.length }})</h5>
                            <div v-if="selectedRoute.participants.length == 0" class="text-muted small">No bookings yet.</div>
                            <div v-else class="table-responsive">
                                <table class="table table-sm table-hover mt-2">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Slots</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="p in selectedRoute.participants" :key="p.book_id">
                                            <td>{{ p.user_name }}<br><span class="small text-muted">{{ p.email }}</span></td>
                                            <td>{{ p.slots }}</td>
                                            <td><span class="badge" :class="p.book_status == 'Booked' ? 'bg-success' : 'bg-secondary'">{{ p.book_status }}</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}
