export default {
    name: "StaffSettings",
    data() {
        return {
            profile: { name: "", email: "", mobile: "", experience: "", skills: "", information: "" },
            profileMsg: "",
            profileErr: "",
            passForm: { old_password: "", new_password: "", confirm: "" },
            passMsg: "",
            passErr: ""
        }
    },
    created() {
        this.loadProfile()
    },
    methods: {
        async loadProfile() {
            try {
                let res = await fetch("/api/staff-detail")
                if (res.ok) {
                    this.profile = await res.json()
                }
            } catch (err) {
                console.log("Profile load failed")
            }
        },
        async saveProfile() {
            this.profileMsg = ""
            this.profileErr = ""
            try {
                let res = await fetch("/api/staff-detail", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.profile)
                })
                let result = await res.json()
                if (res.ok) {
                    this.profileMsg = "Profile saved"
                    localStorage.setItem("user-name", this.profile.name)
                    window.dispatchEvent(new Event("auth-changed"))
                } else {
                    this.profileErr = result.error || "Save failed"
                }
            } catch (err) {
                this.profileErr = "Server error"
            }
        },
        async changePassword() {
            this.passMsg = ""
            this.passErr = ""
            if (!this.passForm.old_password || !this.passForm.new_password) {
                this.passErr = "Fill both fields"
                return
            }
            if (this.passForm.new_password.length < 4) {
                this.passErr = "Min 4 characters"
                return
            }
            if (this.passForm.new_password != this.passForm.confirm) {
                this.passErr = "Passwords do not match"
                return
            }
            try {
                let res = await fetch("/api/staff-change-key", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ old_password: this.passForm.old_password, new_password: this.passForm.new_password })
                })
                let result = await res.json()
                if (res.ok) {
                    this.passMsg = "Password updated"
                    this.passForm = { old_password: "", new_password: "", confirm: "" }
                } else {
                    this.passErr = result.error || "Failed"
                }
            } catch (err) {
                this.passErr = "Server error"
            }
        }
    },
    template: `
        <div>
            <h2 class="border-bottom pb-2 mb-4">Staff Settings</h2>
            <div class="row">
                <div class="col-md-6">
                    <div class="card p-4 shadow-sm mb-4">
                        <h5>Personal Info</h5>
                        <div v-if="profileMsg" class="alert alert-success small">{{ profileMsg }}</div>
                        <div v-if="profileErr" class="alert alert-danger small">{{ profileErr }}</div>
                        <div class="mb-2">
                            <label class="form-label small">Name</label>
                            <input type="text" class="form-control" v-model="profile.name">
                        </div>
                        <div class="mb-2">
                            <label class="form-label small">Email (fixed)</label>
                            <input type="text" class="form-control" :value="profile.email" disabled>
                        </div>
                        <div class="mb-2">
                            <label class="form-label small">Mobile</label>
                            <input type="text" class="form-control" v-model="profile.mobile">
                        </div>
                        <div class="mb-2">
                            <label class="form-label small">Experience</label>
                            <input type="text" class="form-control" v-model="profile.experience">
                        </div>
                        <div class="mb-2">
                            <label class="form-label small">Skills</label>
                            <input type="text" class="form-control" v-model="profile.skills">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small">Information</label>
                            <textarea class="form-control" v-model="profile.information" rows="2"></textarea>
                        </div>
                        <button class="btn btn-primary" @click="saveProfile">Update Profile</button>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card p-4 shadow-sm mb-4">
                        <h5>Change Password</h5>
                        <div v-if="passMsg" class="alert alert-success small">{{ passMsg }}</div>
                        <div v-if="passErr" class="alert alert-danger small">{{ passErr }}</div>
                        <div class="mb-2">
                            <label class="form-label small">Current Password</label>
                            <input type="password" class="form-control" v-model="passForm.old_password">
                        </div>
                        <div class="mb-2">
                            <label class="form-label small">New Password</label>
                            <input type="password" class="form-control" v-model="passForm.new_password">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small">Confirm New Password</label>
                            <input type="password" class="form-control" v-model="passForm.confirm">
                        </div>
                        <button class="btn btn-warning" @click="changePassword">Change Password</button>
                    </div>
                </div>
            </div>
        </div>
    `
}
