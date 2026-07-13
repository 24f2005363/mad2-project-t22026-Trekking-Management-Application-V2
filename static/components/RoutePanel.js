export default {
    name: "RoutePanel",
    data() {
        return {
            treks: [],
            guides: [],
            searchWord: "",
            newTrek: { title: "", place: "", level: "Easy", duration: "", max_slots: "", start_date: "", end_date: "", about: "" },
            trekMsg: "",
            trekErr: "",
            selectedTrekId: null,
            selectedStaffId: "",
            editTrek: null
        }
    },
    created() {
        this.loadTreks()
        this.loadGuides()
    },
    methods: {
        async loadTreks() {
            try {
                const res = await fetch("/api/adm-treks/list")
                if (res.ok) this.treks = await res.json()
            } catch (err) { console.log("Treks load error") }
        },
        async loadGuides() {
            try {
                const res = await fetch("/api/adm-guides/list")
                if (res.ok) this.guides = await res.json()
            } catch (err) { console.log("Guides load error") }
        },
        async searchTreks() {
            if (!this.searchWord.trim()) { this.loadTreks(); return }
            try {
                const res = await fetch("/api/adm-treks/search?word=" + encodeURIComponent(this.searchWord))
                if (res.ok) this.treks = await res.json()
            } catch (err) { console.log("Search error") }
        },
        // Reload treks with the current search query (if active) so that
        // modifications or status changes don't clear the user's filtered view
        refreshTreks() {
            if (this.searchWord.trim()) {
                this.searchTreks()
            } else {
                this.loadTreks()
            }
        },
        async handleCreateTrek() {
            this.trekMsg = ""; this.trekErr = ""
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
                    this.refreshTreks()
                } else {
                    this.trekErr = result.error || "Failed to create trek"
                }
            } catch (err) { this.trekErr = "Server error" }
        },
        async updateTrekStatus(trekId, newStatus) {
            try {
                const res = await fetch("/api/adm-treks/update-state/" + trekId, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus })
                })
                if (res.ok) this.refreshTreks()
            } catch (err) { console.log("Status update error") }
        },
        async deleteTrek(trekId) {
            if (!confirm("Delete this trek?")) return
            try {
                const res = await fetch("/api/adm-treks/remove/" + trekId, { method: "DELETE" })
                if (res.ok) this.refreshTreks()
            } catch (err) { console.log("Delete error") }
        },
        openEditForm(t) {
            this.editTrek = {
                id: t.id,
                title: t.title,
                place: t.place,
                level: t.level,
                duration: t.duration,
                max_slots: t.max_slots,
                start_date: t.start_date,
                end_date: t.end_date,
                about: t.about || ""
            }
        },
        async handleEditTrek() {
            if (!this.editTrek) return
            try {
                const res = await fetch("/api/adm-treks/edit/" + this.editTrek.id, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.editTrek)
                })
                if (res.ok) {
                    this.editTrek = null
                    this.refreshTreks()
                } else {
                    const result = await res.json()
                    alert(result.error || "Edit failed")
                }
            } catch (err) { alert("Server error") }
        },
        openAssignModal(trekId) {
            this.selectedTrekId = trekId
            this.selectedStaffId = ""
        },
        async assignStaffToTrek() {
            if (!this.selectedStaffId) return
            try {
                const res = await fetch("/api/adm-guides/assign-route/" + this.selectedStaffId + "/" + this.selectedTrekId, { method: "POST" })
                if (res.ok) {
                    this.selectedTrekId = null
                    this.refreshTreks()
                } else {
                    const result = await res.json()
                    alert(result.error || "Assignment failed")
                }
            } catch (err) { alert("Connection error") }
        }
    },
    template: `
        <div class="row">
            <div class="col-md-4">
                <div class="card p-3 shadow-sm mb-4">
                    <h5>Create Trek Route</h5>
                    <div v-if="trekMsg" class="alert alert-success small mt-2">{{ trekMsg }}</div>
                    <div v-if="trekErr" class="alert alert-danger small mt-2">{{ trekErr }}</div>
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
            <div class="col-md-8">
                <div class="card p-3 shadow-sm table-responsive">
                    <h5>Trek Routes List</h5>
                    <div class="input-group mb-2 mt-2">
                        <input type="text" class="form-control form-control-sm" placeholder="Search by name or location" v-model="searchWord" @input="searchTreks">
                        <span class="input-group-text small" v-if="searchWord">Filtering...</span>
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
                                    <button class="btn btn-outline-primary btn-sm me-1" @click="openEditForm(t)">Edit</button>
                                    <button class="btn btn-danger btn-sm" @click="deleteTrek(t.id)">Delete</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
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
            <div v-if="editTrek !== null" class="modal d-block bg-dark bg-opacity-50" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Trek Route</h5>
                            <button type="button" class="btn-close" @click="editTrek = null"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-2">
                                <label class="form-label small">Trek Title</label>
                                <input type="text" class="form-control form-control-sm" v-model="editTrek.title">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Place / Location</label>
                                <input type="text" class="form-control form-control-sm" v-model="editTrek.place">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Difficulty Level</label>
                                <select class="form-select form-select-sm" v-model="editTrek.level">
                                    <option>Easy</option>
                                    <option>Moderate</option>
                                    <option>Hard</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Duration (Days)</label>
                                <input type="number" class="form-control form-control-sm" v-model="editTrek.duration">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Max Slots</label>
                                <input type="number" class="form-control form-control-sm" v-model="editTrek.max_slots">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">Start Date</label>
                                <input type="date" class="form-control form-control-sm" v-model="editTrek.start_date">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">End Date</label>
                                <input type="date" class="form-control form-control-sm" v-model="editTrek.end_date">
                            </div>
                            <div class="mb-2">
                                <label class="form-label small">About Description</label>
                                <textarea class="form-control form-control-sm" v-model="editTrek.about" rows="2"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" @click="editTrek = null">Cancel</button>
                            <button type="button" class="btn btn-primary" @click="handleEditTrek">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}
