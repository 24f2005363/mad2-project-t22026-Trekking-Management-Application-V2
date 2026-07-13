export default {
    name: "AccountView",
    data() {
        return {
            name: "",
            email: "",
            mobile: "",
            acctMsg: "",
            acctError: "",
            passForm: { old_password: "", new_password: "", confirm: "" },
            passMsg: "",
            passErr: ""
        }
    },
    created() {
        this.loadAccount()
    },
    methods: {
        async loadAccount() {
            try {
                let res = await fetch("/api/trekker/account")
                if (res.ok) {
                    let d = await res.json()
                    this.name = d.name
                    this.email = d.email
                    this.mobile = d.mobile
                }
            } catch (err) { console.log("Account load error") }
        },
        async saveAccount() {
            this.acctMsg = ""
            this.acctError = ""
            if (!this.name.trim()) {
                this.acctError = "Name is required"
                return
            }
            try {
                let res = await fetch("/api/trekker/account", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: this.name, mobile: this.mobile })
                })
                let result = await res.json()
                if (res.ok) {
                    this.acctMsg = "Profile saved"
                    localStorage.setItem("user-name", this.name)
                    window.dispatchEvent(new Event("auth-changed"))
                } else {
                    this.acctError = result.error || "Save failed"
                }
            } catch (err) { this.acctError = "Server error" }
        },
        async changePasscode() {
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
                let res = await fetch("/api/trekker/change-passcode", {
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
            } catch (err) { this.passErr = "Server error" }
        }
    },
    template: `
        <div>
            <h4>My Account</h4>
            <div class="row">
                <div class="col-md-6">
                    <div class="card p-4 shadow-sm mb-3">
                        <div v-if="acctMsg" class="alert alert-success small">{{ acctMsg }}</div>
                        <div v-if="acctError" class="alert alert-danger small">{{ acctError }}</div>
                        <div class="mb-3">
                            <label class="form-label">Name</label>
                            <input type="text" class="form-control" v-model="name">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Email (not editable)</label>
                            <input type="text" class="form-control" :value="email" disabled>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Mobile</label>
                            <input type="text" class="form-control" v-model="mobile">
                        </div>
                        <button class="btn btn-primary" @click="saveAccount">Save Changes</button>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card p-4 shadow-sm mb-3">
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
                        <button class="btn btn-warning" @click="changePasscode">Change Password</button>
                    </div>
                </div>
            </div>
        </div>
    `
}
