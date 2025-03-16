precision highp float;

// sample2D is how we store a texture
uniform sampler2D u_Texture;

// Holds our uv coordinates of the texture per fragment
varying vec2 v_TexCoord;
void main() {
    // Read each texture coordinate from our texture
    gl_FragColor = texture2D(u_Texture, v_TexCoord);
}