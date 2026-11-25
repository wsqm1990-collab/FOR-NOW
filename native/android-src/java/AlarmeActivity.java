package com.wsqm1990.fornow;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.lang.ref.WeakReference;
import java.text.DateFormat;
import java.util.Date;

/** The ringing screen: works over the lock screen, one big button, nothing else. */
public class AlarmeActivity extends Activity {
    private static WeakReference<AlarmeActivity> atual;

    static void fechar() {
        final AlarmeActivity a = atual == null ? null : atual.get();
        if (a != null) a.runOnUiThread(new Runnable() { @Override public void run() { a.finish(); } });
    }

    @SuppressWarnings("deprecation")
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (!AlarmeService.tocando()) { finish(); return; }
        atual = new WeakReference<>(this);

        float dp = getResources().getDisplayMetrics().density;
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.rgb(0x0B, 0x0A, 0x09));
        int pad = Math.round(24 * dp);
        root.setPadding(pad, pad, pad, pad);

        TextView titulo = new TextView(this);
        titulo.setText(Rotulos.get(this, "alarmTitle", "Time to wake up"));
        titulo.setTextColor(Color.rgb(0xBF, 0xB0, 0x9A));
        titulo.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        titulo.setGravity(Gravity.CENTER);
        root.addView(titulo);

        TextView hora = new TextView(this);
        hora.setText(DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()));
        hora.setTextColor(Color.rgb(0xE9, 0xDF, 0xCF));
        hora.setTextSize(TypedValue.COMPLEX_UNIT_SP, 64);
        hora.setGravity(Gravity.CENTER);
        hora.setPadding(0, Math.round(12 * dp), 0, Math.round(48 * dp));
        root.addView(hora);

        Button desligar = new Button(this);
        desligar.setText(Rotulos.get(this, "alarmOff", "Turn off"));
        desligar.setAllCaps(false);
        desligar.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        desligar.setTextColor(Color.rgb(0x0B, 0x0A, 0x09));
        GradientDrawable fundo = new GradientDrawable();
        fundo.setColor(Color.rgb(0xC9, 0xA2, 0x6B));
        fundo.setCornerRadius(28 * dp);
        desligar.setBackground(fundo);
        desligar.setMinHeight(Math.round(96 * dp));
        desligar.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                AlarmeService.desligar(AlarmeActivity.this);
                finish();
            }
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, Math.round(110 * dp));
        root.addView(desligar, lp);
        setContentView(root);
    }

    @Override
    protected void onDestroy() {
        if (atual != null && atual.get() == this) atual = null;
        super.onDestroy();
    }
}
