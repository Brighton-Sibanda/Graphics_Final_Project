precision highp float;
varying vec2 v_TexCoord;
uniform sampler2D v_Texture;
void main() {
    vec4 mirrorBase = vec4(.1, .1, .1, 1.);
    // we need to flip our X-axis texture coordinate for a mirror
    // there are other ways to do this, but this is the most direct
    vec2 texFlipped = vec2(1.0 - v_TexCoord.x, v_TexCoord.y);
    gl_FragColor = mirrorBase + texture2D(v_Texture, texFlipped) * 0.7;
}