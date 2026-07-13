export default {
    name: "StaffPanel",
    data() {
        return {
            guides: [],
            searchWord: "",
            newGuide: { name: "", email: "", mobile: "", password: "", exp_years: "", skills: "", info: "" },
            guideMsg: "",
            guideErr: ""
        }
    },
    created() {
        this.loadGuides()
    },
    methods: {
        async loadGuides() {
            try {
                const res = await fetch("/api/adm-guides/list")
                if (res.ok) this.guides = await res.json()
            } catch (err) { console.log("Guides load error") }
        },
        async searchGuides() {
            if (!this.searchWord.trim()) { this.loadGuides(); return }
            try {
                const res = await fetch("/api/adm-guides/search?word=" + encodeURIComponent(this.searchWord))
                if (res.ok) this.guides = await res.json()
            } catch (err) { console.log("Search error") }
        },
        // Refresh the guides list using the active filter to prevent losing
        // the current search results or query context after updating a guide
        refreshGuides() {
            if (this.searchWord.trim()) {
                this.searchGuides()
            } else {
                this.loadGuides()
            }
        },
        async handleCreateGuide() {
            this.guideMsg = ""; this.guideErr = ""
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
                    this.refreshGuides()
                } else {
                    this.guideErr = result.error || "Failed to create staff"
                }
            } catch (err) { this.guideErr = "Server error" }
        },
        async toggleGuideBlock(guide) {
            const endpoint = guide.blacklisted ? "/api/adm-guides/unblock/" + guide.guide_profile_id : "/api/adm-guides/block/" + guide.guide_profile_id
            try {
                const res = await fetch(endpoint, { method: "POST" })
                if (res.ok) this.refreshGuides()
            } catch (err) { console.log("Toggle block error") }
        }
    },
    template: `
        <div class="row">
            <div class="col-md-4">
                <div class="card p-3 shadow-sm mb-4">
                    <h5>Create Staff Profile</h5>
                    <div v-if="guideMsg" class="alert alert-success mt-2">{{ guideMsg }}</div>
                    <div v-if="guideErr" class="alert alert-danger mt-2">{{ guideErr }}</div>
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
            <div class="col-md-8">
                <div class="card p-3 shadow-sm table-responsive">
                    <h5>Staff List</h5>
                    <div class="input-group mb-2 mt-2">
                        <input type="text" class="form-control form-control-sm" placeholder="Search by name or email" v-model="searchWord" @input="searchGuides">
                        <span class="input-group-text small" v-if="searchWord">Filtering...</span>
                    </div>
                    <table class="table table-hover mt-3 align-middle">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Mobile</th>
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
                                <td>{{ g.mobile || 'N/A' }}</td>
                                <td>{{ g.skills }}</td>
                                <td>{{ g.exp_years }} years</td>
                                <td><span class="badge" :class="g.state === 'Active' ? 'bg-success' : 'bg-secondary'">{{ g.state }}</span></td>
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
    `
}
