export default {
    name: "Register",
    data() {
        return {
            name: "",
            email: "",
            password: "",
            mobile: "",
            errorMsg: "",
            successMsg: "",
            submitting: false
        }
    },
    methods: {
        async handleRegister() {
            this.errorMsg = ""
            this.successMsg = ""

            if (!this.name || !this.email || !this.password) {
                this.errorMsg = "Name, email and password are required"
                return
            }

            this.submitting = true
            try {
                const response = await fetch("/api/join-trekker", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: this.name,
                        email: this.email,
                        password: this.password,
                        mobile: this.mobile
                    })
                })
                const result = await response.json()

                if (!response.ok) {
                    this.errorMsg = result.error || "Registration failed"
                    return
                }

                this.successMsg = "Registration successful! You can now log in."
                this.name = ""
                this.email = ""
                this.password = ""
                this.mobile = ""

            } catch (err) {
                this.errorMsg = "Server connection error"
            } finally {
                this.submitting = false
            }
        }
    },
    template: `
        <div class="row justify-content-center mt-5">
            <div class="col-md-5">
                <div class="card p-4 shadow-sm">
                    <h3 class="text-center mb-4">Register as Trekker</h3>
                    <div class="alert alert-danger" v-if="errorMsg">{{ errorMsg }}</div>
                    <div class="alert alert-success" v-if="successMsg">{{ successMsg }}</div>
                    <div class="mb-3">
                        <label class="form-label">Full Name</label>
                        <input type="text" class="form-control" v-model="name" placeholder="John Doe">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Email Address</label>
                        <input type="email" class="form-control" v-model="email" placeholder="john@email.com">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Mobile Number</label>
                        <input type="text" class="form-control" v-model="mobile" placeholder="9999999999">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-control" v-model="password" placeholder="••••••••">
                    </div>
                    <button class="btn btn-success w-100" @click="handleRegister" :disabled="submitting">
                        {{ submitting ? 'Registering...' : 'Sign Up' }}
                    </button>
                    <div class="text-center mt-3">
                        <span>Already registered? </span>
                        <router-link to="/">Login Here</router-link>
                    </div>
                </div>
            </div>
        </div>
    `
}
